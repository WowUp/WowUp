import { BehaviorSubject, combineLatest, Observable, Subject } from "rxjs";
import { map, takeUntil } from "rxjs/operators";

import { Component, OnDestroy, OnInit } from "@angular/core";

import {
  FEATURE_ACCOUNTS_ENABLED,
  PREF_TABS_COLLAPSED,
  TAB_INDEX_ABOUT,
  TAB_INDEX_GET_ADDONS,
  TAB_INDEX_MY_ADDONS,
  TAB_INDEX_NEWS,
  TAB_INDEX_SETTINGS,
  TRUE_STR,
} from "../../../../common/constants";
import { AppConfig } from "../../../../environments/environment";
import { ElectronService } from "../../../services";
import { SessionService } from "../../../services/session/session.service";
import { WarcraftInstallationService } from "../../../services/warcraft/warcraft-installation.service";
import { AddonProviderFactory } from "../../../services/addons/addon.provider.factory";
import { MatDialog } from "@angular/material/dialog";
import { AlertDialogComponent } from "../alert-dialog/alert-dialog.component";
import { TranslateService } from "@ngx-translate/core";
import { PreferenceStorageService } from "../../../services/storage/preference-storage.service";
import { AdPageOptions } from "wowup-lib-core";

interface Tab {
  titleKey?: string;
  tooltipKey: string;
  icon: string;
  badge?: boolean;
  isSelected$: Observable<boolean>;
  isDisabled$: Observable<boolean>;
  onClick: (tab: Tab) => void;
}

@Component({
  selector: "app-vertical-tabs",
  templateUrl: "./vertical-tabs.component.html",
  styleUrls: ["./vertical-tabs.component.scss"],
})
export class VerticalTabsComponent implements OnInit, OnDestroy {
  private readonly destroy$: Subject<boolean> = new Subject<boolean>();

  public wowUpWebsiteUrl = AppConfig.wowUpWebsiteUrl;
  public TAB_INDEX_ACCOUNT = TAB_INDEX_ABOUT;
  public FEATURE_ACCOUNTS_ENABLED = FEATURE_ACCOUNTS_ENABLED;
  public adPageParams$ = new BehaviorSubject<AdPageOptions[]>([]);
  public isCollapsedSrc = new BehaviorSubject(false);

  public isCollapsed$ = combineLatest([this.isCollapsedSrc, this.sessionService.adSpace$]).pipe(
    map(([isCollapsed, adSpace]) => {
      if (adSpace) {
        return false;
      }
      return isCollapsed;
    })
  );

  public isAccountSelected$ = this.sessionService.selectedHomeTab$.pipe(map((result) => result === TAB_INDEX_ABOUT));

  private myAddonsTab: Tab = {
    titleKey: "PAGES.HOME.MY_ADDONS_TAB_TITLE",
    tooltipKey: "PAGES.HOME.MY_ADDONS_TAB_TITLE",
    icon: "fas:dice-d6",
    isSelected$: this.sessionService.selectedHomeTab$.pipe(map((result) => result === TAB_INDEX_MY_ADDONS)),
    isDisabled$: combineLatest([
      this._warcraftInstallationService.wowInstallations$,
      this.sessionService.enableControls$,
    ]).pipe(map(([installations, enableControls]) => !enableControls || installations.length === 0)),
    onClick: (): void => {
      this.sessionService.selectedHomeTab = TAB_INDEX_MY_ADDONS;
    },
  };

  private getAddonsTab: Tab = {
    titleKey: "PAGES.HOME.GET_ADDONS_TAB_TITLE",
    tooltipKey: "PAGES.HOME.GET_ADDONS_TAB_TITLE",
    icon: "fas:magnifying-glass",
    isSelected$: this.sessionService.selectedHomeTab$.pipe(map((result) => result === TAB_INDEX_GET_ADDONS)),
    isDisabled$: combineLatest([
      this._warcraftInstallationService.wowInstallations$,
      this.sessionService.enableControls$,
    ]).pipe(map(([installations, enableControls]) => !enableControls || installations.length === 0)),
    onClick: (): void => {
      this.sessionService.selectedHomeTab = TAB_INDEX_GET_ADDONS;
    },
  };

  private aboutTab: Tab = {
    titleKey: "PAGES.HOME.ACCOUNT_TAB_TITLE",
    tooltipKey: "PAGES.HOME.ACCOUNT_TAB_TITLE",
    icon: "fas:user-circle",
    isSelected$: this.sessionService.selectedHomeTab$.pipe(map((result) => result === TAB_INDEX_ABOUT)),
    isDisabled$: this.sessionService.enableControls$.pipe(map((enabled) => !enabled)),
    onClick: (): void => {
      this.sessionService.selectedHomeTab = TAB_INDEX_ABOUT;
    },
  };

  private newsTab: Tab = {
    titleKey: "PAGES.HOME.NEWS_TAB_TITLE",
    tooltipKey: "PAGES.HOME.NEWS_TAB_TITLE",
    icon: "fas:newspaper",
    badge: true,
    isSelected$: this.sessionService.selectedHomeTab$.pipe(map((result) => result === TAB_INDEX_NEWS)),
    isDisabled$: this.sessionService.enableControls$.pipe(map((enabled) => !enabled)),
    onClick: (): void => {
      this.sessionService.selectedHomeTab = TAB_INDEX_NEWS;
    },
  };

  private settingsTab: Tab = {
    titleKey: "PAGES.HOME.OPTIONS_TAB_TITLE",
    tooltipKey: "PAGES.HOME.OPTIONS_TAB_TITLE",
    icon: "fas:gear",
    isSelected$: this.sessionService.selectedHomeTab$.pipe(map((result) => result === TAB_INDEX_SETTINGS)),
    isDisabled$: this.sessionService.enableControls$.pipe(map((enabled) => !enabled)),
    onClick: (): void => {
      this.sessionService.selectedHomeTab = TAB_INDEX_SETTINGS;
    },
  };

  public tabsTop: Tab[] = [this.myAddonsTab, this.getAddonsTab, this.newsTab];

  public tabsBottom: Tab[] = [this.settingsTab];

  public constructor(
    public electronService: ElectronService,
    public sessionService: SessionService,
    private _dialog: MatDialog,
    private _translateService: TranslateService,
    private _addonProviderService: AddonProviderFactory,
    private _warcraftInstallationService: WarcraftInstallationService,
    private _preferences: PreferenceStorageService
  ) {
    this.sessionService.adSpace$.pipe(takeUntil(this.destroy$)).subscribe((enabled) => {
      if (enabled) {
        const providers = this._addonProviderService.getAdRequiredProviders();
        const providerParams = providers
          .map((provider) => provider.getAdPageParams())
          .filter((param) => param !== undefined);

        console.debug("providerParams", providerParams);

        this.adPageParams$.next(providerParams);
      } else {
        this.adPageParams$.next([]);
      }
    });
  }

  public ngOnInit(): void {
    this._preferences
      .getAsync(PREF_TABS_COLLAPSED)
      .then((val) => {
        this.isCollapsedSrc.next(val === TRUE_STR);
      })
      .catch(console.error);
  }

  public ngOnDestroy(): void {
    this.destroy$.next(true);
    this.destroy$.unsubscribe();
  }

  public async toggleCollapse(): Promise<void> {
    try {
      const nextVal = !this.isCollapsedSrc.value;
      await this._preferences.setAsync(PREF_TABS_COLLAPSED, nextVal);
      this.isCollapsedSrc.next(!this.isCollapsedSrc.value);
    } catch (e) {
      console.error(e);
    }
  }

  public onClickTab(tabIndex: number): void {
    this.sessionService.selectedHomeTab = tabIndex;
  }

  public onClickAdExplainer(): void {
    this._dialog.open(AlertDialogComponent, {
      minWidth: 250,
      maxWidth: 400,
      disableClose: true,
      data: {
        title: this._translateService.instant("ADS.AD_EXPLAINER_DIALOG.TITLE"),
        message: this._translateService.instant("ADS.AD_EXPLAINER_DIALOG.MESSAGE"),
      },
    });
  }
}
