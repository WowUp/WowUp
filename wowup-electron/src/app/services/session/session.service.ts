import * as _ from "lodash";
import { BehaviorSubject, combineLatest, from, Subject } from "rxjs";

import { Injectable } from "@angular/core";

import { CURRENT_THEME_KEY, SELECTED_DETAILS_TAB_KEY, TAB_INDEX_SETTINGS } from "../../../common/constants";
import { WowInstallation } from "../../../common/warcraft/wow-installation";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { WarcraftInstallationService } from "../warcraft/warcraft-installation.service";
import { ColumnState } from "../../models/wowup/column-state";
import { map, switchMap } from "rxjs/operators";
import { WowUpAccountService } from "../wowup/wowup-account.service";
import { AddonService } from "../addons/addon.service";
import { AddonProviderFactory } from "../addons/addon.provider.factory";
import { WowUpService } from "../wowup/wowup.service";

@Injectable({
  providedIn: "root",
})
export class SessionService {
  private readonly _selectedWowInstallationSrc = new BehaviorSubject<WowInstallation | undefined>(undefined);
  private readonly _pageContextTextSrc = new BehaviorSubject(""); // right side bar text, context to the screen
  private readonly _statusTextSrc = new BehaviorSubject(""); // left side bar text, context to the app
  private readonly _selectedHomeTabSrc = new BehaviorSubject(0);
  private readonly _autoUpdateCompleteSrc = new BehaviorSubject(0);
  private readonly _addonsChangedSrc = new Subject<boolean>();
  private readonly _myAddonsColumnsSrc = new BehaviorSubject<ColumnState[]>([]);
  private readonly _targetFileInstallCompleteSrc = new Subject<boolean>();
  private readonly _myAddonsCompactVersionSrc = new BehaviorSubject<boolean>(false);
  private readonly _adSpaceSrc = new BehaviorSubject<boolean>(false);
  private readonly _enableControlsSrc = new BehaviorSubject<boolean>(false);
  private readonly _getAddonsColumnsSrc = new Subject<ColumnState>();
  private readonly _currentThemeSrc = new BehaviorSubject<string>("default-theme");
  private readonly _rescanCompleteSrc = new Subject<boolean>();

  private _selectedDetailTabType: DetailsTabType;

  public readonly selectedWowInstallation$ = this._selectedWowInstallationSrc.asObservable();
  public readonly statusText$ = this._statusTextSrc.asObservable();
  public readonly selectedHomeTab$ = this._selectedHomeTabSrc.asObservable();
  public readonly pageContextText$ = this._pageContextTextSrc.asObservable();
  public readonly autoUpdateComplete$ = this._autoUpdateCompleteSrc.asObservable();
  public readonly addonsChanged$ = this._addonsChangedSrc.asObservable();
  public readonly myAddonsHiddenColumns$ = this._myAddonsColumnsSrc.asObservable();
  public readonly getAddonsHiddenColumns$ = this._getAddonsColumnsSrc.asObservable();
  public readonly targetFileInstallComplete$ = this._targetFileInstallCompleteSrc.asObservable();
  public readonly editingWowInstallationId$ = new BehaviorSubject<string>("");
  public readonly wowUpAuthToken$ = this._wowUpAccountService.wowUpAuthTokenSrc.asObservable();
  public readonly wowUpAccount$ = this._wowUpAccountService.wowUpAccountSrc.asObservable();
  public readonly wowUpAccountPushEnabled$ = this._wowUpAccountService.accountPushSrc.asObservable();
  public readonly myAddonsCompactVersion$ = this._myAddonsCompactVersionSrc.asObservable();
  public readonly adSpace$ = this._adSpaceSrc.asObservable(); // TODO this should be driven by the enabled providers
  public readonly enableControls$ = combineLatest([this._enableControlsSrc, this._addonService.syncing$]).pipe(
    map(([enable, syncing]) => enable && !syncing)
  );
  public readonly debugAdFrame$ = new Subject<boolean>();
  public readonly currentTheme$ = this._currentThemeSrc.asObservable();
  public readonly rescanComplete$ = this._rescanCompleteSrc.asObservable();

  public readonly wowUpAuthenticated$ = this.wowUpAccount$.pipe(map((account) => account !== undefined));

  public set myAddonsCompactVersion(val: boolean) {
    this._myAddonsCompactVersionSrc.next(val);
  }

  public constructor(
    private _warcraftInstallationService: WarcraftInstallationService,
    private _preferenceStorageService: PreferenceStorageService,
    private _wowUpAccountService: WowUpAccountService,
    private _wowUpService: WowUpService,
    private _addonService: AddonService,
    private _addonProviderService: AddonProviderFactory
  ) {
    this._preferenceStorageService
      .getObjectAsync<DetailsTabType>(SELECTED_DETAILS_TAB_KEY)
      .then((obj) => {
        this._selectedDetailTabType = obj || "description";
      })
      .catch((e) => console.error(e));

    this._warcraftInstallationService.wowInstallations$
      .pipe(switchMap((installations) => from(this.onWowInstallationsChange(installations))))
      .subscribe();

    this._wowUpService.preferenceChange$.subscribe((change) => {
      if (change.key === CURRENT_THEME_KEY) {
        this._currentThemeSrc.next(change.value);
      }
    });

    this._wowUpService
      .getCurrentTheme()
      .then((theme) => {
        this._currentThemeSrc.next(theme);
      })
      .catch(console.error);

    this._addonProviderService.addonProviderChange$.subscribe(() => {
      this.updateAdSpace();
    });

    this.updateAdSpace();
  }

  private updateAdSpace() {
    const allProviders = this._addonProviderService.getEnabledAddonProviders();
    this._adSpaceSrc.next(allProviders.findIndex((p) => p.adRequired) !== -1);
  }

  public get wowUpAuthToken(): string {
    return this._wowUpAccountService.wowUpAuthTokenSrc.value;
  }

  public get currentTheme(): string {
    return this._currentThemeSrc.value;
  }

  public login(): void {
    this._wowUpAccountService.login();
  }

  public logout(): void {
    this._wowUpAccountService.logout();
  }

  public setEnableControls(enabled: boolean): void {
    this._enableControlsSrc.next(enabled);
  }

  public async toggleAccountPush(enabled: boolean): Promise<void> {
    return await this._wowUpAccountService.toggleAccountPush(enabled);
  }

  public isAuthenticated(): boolean {
    return false;
  }

  public notifyTargetFileInstallComplete(): void {
    this._targetFileInstallCompleteSrc.next(true);
  }

  public notifyAddonsChanged(): void {
    this._addonsChangedSrc.next(true);
  }

  public getSelectedDetailsTab(): DetailsTabType {
    return this._selectedDetailTabType;
  }

  public async setSelectedDetailsTab(tabType: DetailsTabType) {
    this._selectedDetailTabType = tabType;
    await this._preferenceStorageService.setAsync(SELECTED_DETAILS_TAB_KEY, tabType);
  }

  public async onWowInstallationsChange(wowInstallations: WowInstallation[]): Promise<void> {
    if (wowInstallations.length === 0) {
      this._selectedHomeTabSrc.next(TAB_INDEX_SETTINGS);
      return;
    }

    let selectedInstall = _.find(wowInstallations, (installation) => installation.selected);
    if (!selectedInstall) {
      selectedInstall = _.first(wowInstallations);
      if (selectedInstall) {
        await this.setSelectedWowInstallation(selectedInstall.id);
      }
    }

    if (selectedInstall) {
      this._selectedWowInstallationSrc.next(selectedInstall);
    }
  }

  public autoUpdateComplete(): void {
    this._autoUpdateCompleteSrc.next(Date.now());
  }

  public setContextText(tabIndex: number, text: string): void {
    if (tabIndex !== this._selectedHomeTabSrc.value) {
      return;
    }

    this._pageContextTextSrc.next(text);
  }

  public set statusText(text: string) {
    this._statusTextSrc.next(text);
  }

  public getSelectedHomeTab(): number {
    return this._selectedHomeTabSrc.value;
  }

  public set selectedHomeTab(tabIndex: number) {
    this._pageContextTextSrc.next("");
    this._selectedHomeTabSrc.next(tabIndex);
  }

  public async setSelectedWowInstallation(installationId: string): Promise<void> {
    if (!installationId) {
      return;
    }

    const installation = this._warcraftInstallationService.getWowInstallation(installationId);
    if (!installation) {
      return;
    }

    await this._warcraftInstallationService.setSelectedWowInstallation(installation);
    this._selectedWowInstallationSrc.next(installation);
  }

  public getSelectedWowInstallation(): WowInstallation | undefined {
    return this._selectedWowInstallationSrc.value;
  }

  public rescanCompleted() {
    this._rescanCompleteSrc.next(true);
  }
}
