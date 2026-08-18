import { Injectable } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { fromEvent, Subject } from "rxjs";
import { auditTime, filter, takeUntil } from "rxjs/operators";
import { AdPageOptions } from "wowup-lib-core";

import { AppConfig } from "../../../environments/environment";
import { AddonProviderFactory } from "../addons/addon.provider.factory";
import { AdsApiService } from "../api/ads-api.service";
import { SessionService } from "../session/session.service";
import { UiMessageService } from "../ui-message/ui-message.service";
import { ZoomService } from "../zoom/zoom.service";

/**
 * Drives the native ad view that the main process owns.
 *
 * The renderer's only jobs are deciding when an ad is required, telling main which page to load,
 * and keeping main informed about the rect the layout reserved for it. The view is parked rather
 * than unloaded whenever it should not be visible, because the ad page is also what hands the wago
 * provider its api key.
 *
 * The ad network requires the consent window to have run and closed before any ad is requested, so
 * the first load of each launch waits for it. This service is created by the component that hosts the
 * ad, which only exists once the app's own startup dialogs are done, so the consent window cannot
 * end up racing them.
 */
@Injectable({
  providedIn: "root",
})
export class AdService {
  private readonly _destroy$ = new Subject<boolean>();

  private _hostElement: HTMLElement | undefined;
  private _resizeObserver: ResizeObserver | undefined;
  private _adsRequired = false;
  private _suppressed = false;
  private _consentWindowRun: Promise<void> | undefined;

  public constructor(
    private readonly _adsApi: AdsApiService,
    private readonly _sessionService: SessionService,
    private readonly _addonProviderService: AddonProviderFactory,
    private readonly _uiMessageService: UiMessageService,
    private readonly _dialog: MatDialog,
    private readonly _zoomService: ZoomService,
  ) {
    if (!AppConfig.wago.enabled) {
      return;
    }

    this._sessionService.adSpace$.pipe(takeUntil(this._destroy$)).subscribe((adSpace) => {
      this.onAdSpaceChanged(adSpace);
    });

    // A dialog dims and covers the app, but a native view paints above the page, so park it while
    // any dialog is up.
    this._dialog.afterOpened.pipe(takeUntil(this._destroy$)).subscribe(() => this.setSuppressed(true));
    this._dialog.afterAllClosed.pipe(takeUntil(this._destroy$)).subscribe(() => this.setSuppressed(false));

    // Css pixels do not change when the zoom factor does, so main needs a nudge to rescale.
    this._zoomService.zoomFactor$.pipe(takeUntil(this._destroy$)).subscribe(() => this.reportBounds());

    // A window resize can move the ad host without resizing it, which no observer would catch.
    fromEvent(window, "resize")
      .pipe(takeUntil(this._destroy$), auditTime(16))
      .subscribe(() => this.reportBounds());

    this._uiMessageService.message$
      .pipe(
        takeUntil(this._destroy$),
        filter((msg) => msg.action === "ad-frame-reload"),
      )
      .subscribe(() => {
        this._adsApi.reload().catch((e) => console.error("[ads] failed to reload ad view", e));
      });

    this._sessionService.debugAdFrame$.pipe(takeUntil(this._destroy$)).subscribe(() => {
      this._adsApi.openDevTools().catch((e) => console.error("[ads] failed to open ad dev tools", e));
    });
  }

  /**
   * Registered by the component that reserves space for the ad. Passing undefined (the element was
   * removed from the layout) parks the view.
   */
  public setHostElement(element: HTMLElement | undefined): void {
    if (!AppConfig.wago.enabled || this._hostElement === element) {
      return;
    }

    this._resizeObserver?.disconnect();
    this._resizeObserver = undefined;
    this._hostElement = element;

    if (element === undefined) {
      this.parkView();
      return;
    }

    this._resizeObserver = new ResizeObserver(() => this.reportBounds());
    this._resizeObserver.observe(element);
    this.reportBounds();
  }

  /** Let the user revisit a consent decision, then pick the new one up. */
  public async resurfaceCmp(): Promise<void> {
    await this._adsApi.resurfaceCmp();
    await this._adsApi.reload();
  }

  private onAdSpaceChanged(adSpace: boolean): void {
    this._adsRequired = adSpace;

    if (!adSpace) {
      this._adsApi.disable().catch((e) => console.error("[ads] failed to disable ads", e));
      return;
    }

    const options = this.getAdPageOptions();
    if (options === undefined) {
      console.warn("[ads] an ad is required but no provider offered a page to load");
      return;
    }

    this.loadAfterConsent(options).catch((e) => console.error("[ads] failed to load ads", e));
  }

  private async loadAfterConsent(options: AdPageOptions): Promise<void> {
    await this.runConsentWindow();

    if (!this._adsRequired) {
      // The ad stopped being required while consent was being dealt with.
      return;
    }

    // Load even if the layout has not reported a rect yet, the page is what provides the provider
    // api key and the view stays parked until there is somewhere to put it.
    await this._adsApi.load(options);
    this.reportBounds();
  }

  /**
   * Runs the consent page once per launch and resolves when its window is gone.
   *
   * This is not just a prompt: the consent page is what establishes the consent state that the ad
   * page then reads out of the shared session, and it decides for itself whether any ui is needed,
   * closing itself silently when it is not. Skipping it on later launches leaves the ad page with no
   * consent state to find, and it renders its own consent ui inside the ad instead.
   */
  private runConsentWindow(): Promise<void> {
    this._consentWindowRun ??= this._adsApi.showCmp().catch((e) => {
      this._consentWindowRun = undefined;
      throw e;
    });

    return this._consentWindowRun;
  }

  private getAdPageOptions(): AdPageOptions | undefined {
    const options = this._addonProviderService
      .getAdRequiredProviders()
      .map((provider) => provider.getAdPageParams())
      .filter((params): params is AdPageOptions => params !== undefined && params.pageUrl.length > 0);

    if (options.length > 1) {
      console.warn(`[ads] ${options.length} providers want an ad, only the first one gets shown`);
    }

    return options[0];
  }

  private setSuppressed(suppressed: boolean): void {
    if (this._suppressed === suppressed) {
      return;
    }

    this._suppressed = suppressed;

    if (suppressed) {
      this.parkView();
    } else {
      this.reportBounds();
    }
  }

  private reportBounds(): void {
    if (!AppConfig.wago.enabled || !this._adsRequired) {
      return;
    }

    if (this._hostElement === undefined || this._suppressed) {
      this.parkView();
      return;
    }

    const rect = this._hostElement.getBoundingClientRect();
    this._adsApi
      .setBounds({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
      .catch((e) => console.error("[ads] failed to set ad bounds", e));
  }

  private parkView(): void {
    if (!AppConfig.wago.enabled) {
      return;
    }

    this._adsApi.setBounds().catch((e) => console.error("[ads] failed to park ad view", e));
  }
}
