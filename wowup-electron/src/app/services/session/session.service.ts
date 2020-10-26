import { Injectable, InjectionToken } from "@angular/core";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { UpdateCheckResult } from "electron-updater";
import { BehaviorSubject } from "rxjs";
import { filter, first, map } from "rxjs/operators";
import { WarcraftService } from "../warcraft/warcraft.service";
import { WowUpService } from "../wowup/wowup.service";

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
  private readonly _wowupUpdateInfoSrc = new BehaviorSubject<UpdateCheckResult>(
    undefined
  );

  public readonly selectedClientType$ = this._selectedClientTypeSrc.asObservable();
  public readonly statusText$ = this._statusTextSrc.asObservable();
  public readonly selectedHomeTab$ = this._selectedHomeTabSrc.asObservable();
  public readonly pageContextText$ = this._pageContextTextSrc.asObservable();
  public readonly wowupUpdateInfo$ = this._wowupUpdateInfoSrc.asObservable();

  constructor(
    private _warcraftService: WarcraftService,
    private _wowUpService: WowUpService
  ) {
    this.loadInitialClientType().pipe(first()).subscribe();
  }

  public setContextText(tabIndex: number, text: string) {
    if (tabIndex !== this._selectedHomeTabSrc.value) {
      return;
    }

    this._pageContextTextSrc.next(text);
  }

  public set statusText(text: string) {
    this._statusTextSrc.next(text);
  }

  public set selectedHomeTab(tabIndex: number) {
    this._pageContextTextSrc.next("");
    this._selectedHomeTabSrc.next(tabIndex);
  }

  public set selectedClientType(clientType: WowClientType) {
    this._wowUpService.lastSelectedClientType = clientType;
    this._selectedClientTypeSrc.next(clientType);
  }

  public get selectedClientType() {
    return this._selectedClientTypeSrc.value;
  }

  public set wowupUpdateData(updateInfo: UpdateCheckResult) {
    this._wowupUpdateInfoSrc.next(updateInfo);
  }

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
}
