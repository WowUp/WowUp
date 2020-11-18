import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { filter, first, map } from "rxjs/operators";
import { first as ldFirst } from "lodash";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { WarcraftService } from "../warcraft/warcraft.service";
import { WowUpService } from "../wowup/wowup.service";

@Injectable({
  providedIn: "root",
})
export class SessionService {
  private readonly _selectedClientTypeSrc = new BehaviorSubject(WowClientType.None);
  private readonly _pageContextTextSrc = new BehaviorSubject(""); // right side bar text, context to the screen
  private readonly _statusTextSrc = new BehaviorSubject(""); // left side bar text, context to the app
  private readonly _selectedHomeTabSrc = new BehaviorSubject(0);
  private readonly _autoUpdateCompleteSrc = new BehaviorSubject(0);

  public readonly selectedClientType$ = this._selectedClientTypeSrc.asObservable();
  public readonly statusText$ = this._statusTextSrc.asObservable();
  public readonly selectedHomeTab$ = this._selectedHomeTabSrc.asObservable();
  public readonly pageContextText$ = this._pageContextTextSrc.asObservable();
  public readonly autoUpdateComplete$ = this._autoUpdateCompleteSrc.asObservable();

  constructor(private _warcraftService: WarcraftService, private _wowUpService: WowUpService) {
    this.loadInitialClientType().pipe(first()).subscribe();

    this._warcraftService.installedClientTypes$
      .pipe(filter((clientTypes) => !!clientTypes))
      .subscribe((clientTypes) => this.onInstalledClientsChange(clientTypes));
  }

  public onInstalledClientsChange(installedClientTypes: WowClientType[]) {
    if (!installedClientTypes.length) {
      this._selectedClientTypeSrc.next(WowClientType.None);
    }

    if (installedClientTypes.indexOf(this.selectedClientType) !== -1) {
      return;
    }

    this.selectedClientType = ldFirst(installedClientTypes);
  }

  public autoUpdateComplete() {
    this._autoUpdateCompleteSrc.next(Date.now());
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

  private loadInitialClientType() {
    return this._warcraftService.installedClientTypes$.pipe(
      filter((clientTypes) => clientTypes !== undefined),
      first((installedClientTypes) => installedClientTypes.length > 0),
      map((installedClientTypes) => {
        console.log("installedClientTypes", installedClientTypes);
        const lastSelectedType = this._wowUpService.lastSelectedClientType;
        console.log("lastSelectedType", lastSelectedType);
        let initialClientType = installedClientTypes.length ? installedClientTypes[0] : WowClientType.None;

        // If the user has no stored type, or the type is no longer found just set it.
        if (lastSelectedType == WowClientType.None || !installedClientTypes.some((ct) => ct == lastSelectedType)) {
          this._wowUpService.lastSelectedClientType = initialClientType;
        } else {
          initialClientType = lastSelectedType;
        }

        this._selectedClientTypeSrc.next(initialClientType);
      })
    );
  }
}
