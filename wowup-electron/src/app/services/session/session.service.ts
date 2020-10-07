import { Injectable } from "@angular/core";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { BehaviorSubject } from "rxjs";
import { filter, first, map } from "rxjs/operators";
import { AddonService } from "../addons/addon.service";
import { ElectronService } from "../electron/electron.service";
import { WarcraftService } from "../warcraft/warcraft.service";
import { WowUpService } from "../wowup/wowup.service";

const AUTO_UPDATE_PERIOD_MS = 60 * 60 * 1000; // 1 hour

@Injectable({
  providedIn: "root",
})
export class SessionService {
  private readonly _selectedClientTypeSrc = new BehaviorSubject(
    WowClientType.None
  );
  private readonly _pageContextTextSrc = new BehaviorSubject(""); // right side bar text, context to the screen
  private readonly _statusTextSrc = new BehaviorSubject(""); // left side bar text, context to the app
  private readonly _selectedHomeTabSrc = new BehaviorSubject(0);

  private _autoUpdateInterval?: number;

  public readonly selectedClientType$ = this._selectedClientTypeSrc.asObservable();
  public readonly statusText$ = this._statusTextSrc.asObservable();
  public readonly selectedHomeTab$ = this._selectedHomeTabSrc.asObservable();
  public readonly pageContextText$ = this._pageContextTextSrc.asObservable();

  constructor(
    private _addonService: AddonService,
    private _warcraftService: WarcraftService,
    private _wowUpService: WowUpService
  ) {
    this.loadInitialClientType().pipe(first()).subscribe();
  }

  public set contextText(text: string){
    this._pageContextTextSrc.next(text);
  }

  public set selectedHomeTab(tabIndex: number) {
    this._selectedHomeTabSrc.next(tabIndex);
    this.contextText = '';
  }

  public set selectedClientType(clientType: WowClientType) {
    this._wowUpService.lastSelectedClientType = clientType;
    this._selectedClientTypeSrc.next(clientType);
  }

  public get selectedClientType() {
    return this._selectedClientTypeSrc.value;
  }

  public appLoaded() {
    if (!this._autoUpdateInterval) {
      this.onAutoUpdateInterval();
      this._autoUpdateInterval = window.setInterval(
        this.onAutoUpdateInterval,
        AUTO_UPDATE_PERIOD_MS
      );
    }
  }

  public startUpdaterCheck() {
    this.checkUpdaterApp();
  }

  private onAutoUpdateInterval = async () => {
    console.log("Auto update");
    const updateCount = await this._addonService.processAutoUpdates();
  };

  private loadInitialClientType() {
    return this._warcraftService.installedClientTypes$.pipe(
      filter((clientTypes) => clientTypes !== undefined),
      first((installedClientTypes) => installedClientTypes.length > 0),
      map((installedClientTypes) => {
        console.log("installedClientTypes", installedClientTypes);
        const lastSelectedType = this._wowUpService.lastSelectedClientType;
        console.log("lastSelectedType", lastSelectedType);
        let initialClientType = installedClientTypes.length
          ? installedClientTypes[0]
          : WowClientType.None;

        // If the user has no stored type, or the type is no longer found just set it.
        if (
          lastSelectedType == WowClientType.None ||
          !installedClientTypes.some((ct) => ct == lastSelectedType)
        ) {
          this._wowUpService.lastSelectedClientType = initialClientType;
        } else {
          initialClientType = lastSelectedType;
        }

        this._selectedClientTypeSrc.next(initialClientType);
      })
    );
  }

  private checkUpdaterApp() {
    this._statusTextSrc.next("Checking updater app...");
    this._wowUpService
      .checkUpdaterApp((progress) => {
        this._statusTextSrc.next(`Downloading updater (${progress}%)...`);
      })
      .subscribe({
        next: () => {
          this._statusTextSrc.next("");
        },
        error: (err) => {
          this._statusTextSrc.next("Updater check error");
        },
      });
  }
}
