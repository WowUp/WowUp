import { Injectable } from "@angular/core";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { BehaviorSubject } from "rxjs";
import { first, map } from "rxjs/operators";
import { ElectronService } from "../electron/electron.service";
import { WarcraftService } from "../warcraft/warcraft.service";
import { WowUpService } from "../wowup/wowup.service";

@Injectable({
  providedIn: 'root'
})
export class SessionService {

  private readonly _selectedClientTypeSrc = new BehaviorSubject(WowClientType.None);
  private readonly _statusTextSrc = new BehaviorSubject('');
  private readonly _selectedHomeTab = new BehaviorSubject(0);

  public readonly selectedClientType$ = this._selectedClientTypeSrc.asObservable();
  public readonly statusText$ = this._statusTextSrc.asObservable();
  public readonly selectedHomeTab$ = this._selectedHomeTab.asObservable();

  constructor(
    private _electronService: ElectronService,
    private _warcraftService: WarcraftService,
    private _wowUpService: WowUpService
  ) {
    this.loadInitialClientType().pipe(first()).subscribe();
  }

  public set selectedHomeTab(tabIndex: number) {
    this._selectedHomeTab.next(tabIndex);
  }

  public set selectedClientType(clientType: WowClientType) {
    this._wowUpService.lastSelectedClientType = clientType;
    this._selectedClientTypeSrc.next(clientType);
  }

  public get selectedClientType() {
    return this._selectedClientTypeSrc.value;
  }

  public startUpdaterCheck() {
    this.checkUpdaterApp();
  }

  private loadInitialClientType() {
    return this._warcraftService.installedClientTypes$
      .pipe(
        first(installedClientTypes => installedClientTypes.length > 0),
        map(installedClientTypes => {
          console.log('installedClientTypes', installedClientTypes)
          const lastSelectedType = this._wowUpService.lastSelectedClientType;
          console.log('lastSelectedType', lastSelectedType)
          let initialClientType = installedClientTypes.length ? installedClientTypes[0] : WowClientType.None;

          // If the user has no stored type, or the type is no longer found just set it.
          if (lastSelectedType == WowClientType.None || !installedClientTypes.some(ct => ct == lastSelectedType)) {
            this._wowUpService.lastSelectedClientType = initialClientType;
          }
          else {
            initialClientType = lastSelectedType;
          }

          this._selectedClientTypeSrc.next(initialClientType);
        })
      );
  }

  private checkUpdaterApp() {
    this._statusTextSrc.next('Checking updater app...');
    this._wowUpService.checkUpdaterApp((progress) => {
      this._statusTextSrc.next(`Downloading updater (${progress}%)...`);
    })
      .subscribe({
        next: () => {
          this._statusTextSrc.next('');
        },
        error: (err) => {
          this._statusTextSrc.next('Updater check error');
        }
      });
  }


}