import * as _ from "lodash";
import { BehaviorSubject, Subject } from "rxjs";

import { Injectable } from "@angular/core";

import { SELECTED_DETAILS_TAB_KEY, TAB_INDEX_SETTINGS } from "../../../common/constants";
import { WowInstallation } from "../../../common/warcraft/wow-installation";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { WarcraftInstallationService } from "../warcraft/warcraft-installation.service";
import { ColumnState } from "../../models/wowup/column-state";
import { map } from "rxjs/operators";
import { WowUpAccountService } from "../wowup/wowup-account.service";
import { AddonService } from "../addons/addon.service";

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

  private readonly _getAddonsColumnsSrc = new Subject<ColumnState>();

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

  public readonly wowUpAuthenticated$ = this.wowUpAccount$.pipe(map((account) => account !== undefined));

  public set myAddonsCompactVersion(val: boolean) {
    this._myAddonsCompactVersionSrc.next(val);
  }

  public constructor(
    private _warcraftInstallationService: WarcraftInstallationService,
    private _preferenceStorageService: PreferenceStorageService,
    private _wowUpAccountService: WowUpAccountService,
    private _addonService: AddonService
  ) {
    this._selectedDetailTabType =
      this._preferenceStorageService.getObject<DetailsTabType>(SELECTED_DETAILS_TAB_KEY) || "description";

    this._warcraftInstallationService.wowInstallations$.subscribe((installations) =>
      this.onWowInstallationsChange(installations)
    );

    this._addonService.addonProviderChange$.subscribe((provider) => {
      this.updateAdSpace();
    });

    this.updateAdSpace();
  }

  private updateAdSpace() {
    const allProviders = this._addonService.getEnabledAddonProviders();
    this._adSpaceSrc.next(allProviders.findIndex((p) => p.adRequired) !== -1);
  }

  public get wowUpAuthToken(): string {
    return this._wowUpAccountService.wowUpAuthTokenSrc.value;
  }

  public login(): void {
    this._wowUpAccountService.login();
  }

  public logout(): void {
    this._wowUpAccountService.logout();
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

  public setSelectedDetailsTab(tabType: DetailsTabType): void {
    this._selectedDetailTabType = tabType;
    this._preferenceStorageService.set(SELECTED_DETAILS_TAB_KEY, tabType);
  }

  public onWowInstallationsChange(wowInstallations: WowInstallation[]): void {
    if (wowInstallations.length === 0) {
      this._selectedHomeTabSrc.next(TAB_INDEX_SETTINGS);
      return;
    }

    let selectedInstall = _.find(wowInstallations, (installation) => installation.selected);
    if (!selectedInstall) {
      selectedInstall = _.first(wowInstallations);
      if (selectedInstall) {
        this.setSelectedWowInstallation(selectedInstall.id);
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

  public setSelectedWowInstallation(installationId: string): void {
    if (!installationId) {
      return;
    }

    const installation = this._warcraftInstallationService.getWowInstallation(installationId);
    if (!installation) {
      return;
    }

    this._warcraftInstallationService.setSelectedWowInstallation(installation);
    this._selectedWowInstallationSrc.next(installation);
  }

  public getSelectedWowInstallation(): WowInstallation | undefined {
    return this._selectedWowInstallationSrc.value;
  }
}
