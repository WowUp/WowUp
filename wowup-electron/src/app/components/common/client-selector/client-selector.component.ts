import { Component, Input, OnInit } from "@angular/core";
import { BehaviorSubject, combineLatest, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { WowInstallation } from "../../../../common/warcraft/wow-installation";
import { AddonService } from "../../../services/addons/addon.service";
import { SessionService } from "../../../services/session/session.service";
import { WarcraftInstallationService } from "../../../services/warcraft/warcraft-installation.service";

@Component({
  selector: "app-client-selector",
  templateUrl: "./client-selector.component.html",
  styleUrls: ["./client-selector.component.scss"],
})
export class ClientSelectorComponent implements OnInit {
  @Input() updates: boolean = false;

  public readonly totalAvailableUpdateCt$ = new BehaviorSubject<number>(0);

  public readonly enableControls$ = new BehaviorSubject<boolean>(true);

  public readonly selectedWowInstallationId$ = this._sessionService.selectedWowInstallation$.pipe(
    map((wowInstall) => wowInstall?.id)
  );

  public readonly selectedWowInstallationLabel$ = this._sessionService.selectedWowInstallation$.pipe(
    map((wowInstall) => wowInstall?.label ?? "")
  );

  public wowInstallations$: Observable<WowInstallation[]> = combineLatest([
    this._warcraftInstallationService.wowInstallations$,
    this._addonService.anyUpdatesAvailable$,
  ]).pipe(
    map(([installations]) => {
      let total = 0;
      installations.forEach((inst) => {
        inst.availableUpdateCount = this._addonService.getAllAddonsAvailableForUpdate(inst).length;
        total += inst.availableUpdateCount;
      });

      this.totalAvailableUpdateCt$.next(total);
      return installations;
    })
  );

  constructor(
    private _addonService: AddonService,
    private _sessionService: SessionService,
    private _warcraftInstallationService: WarcraftInstallationService
  ) {}

  ngOnInit(): void {}

  public onClientChange(evt: any): void {
    const val: string = evt.value.toString();
    this._sessionService.setSelectedWowInstallation(val);
  }
}
