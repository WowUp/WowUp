import { Component, Input, OnInit } from "@angular/core";
import { BehaviorSubject, combineLatest, Observable } from "rxjs";
import { map, switchMap } from "rxjs/operators";
import { WowInstallation } from "wowup-lib-core";
import { AddonService } from "../../../services/addons/addon.service";
import { SessionService } from "../../../services/session/session.service";
import { WarcraftInstallationService } from "../../../services/warcraft/warcraft-installation.service";

@Component({
  selector: "app-client-selector",
  templateUrl: "./client-selector.component.html",
  styleUrls: ["./client-selector.component.scss"],
})
export class ClientSelectorComponent implements OnInit {
  @Input() public updates = false;

  public readonly totalAvailableUpdateCt$ = new BehaviorSubject<number>(0);

  public readonly enableControls$ = this._sessionService.enableControls$;

  public readonly selectedWowInstallationId$ = this._sessionService.selectedWowInstallation$.pipe(
    map((wowInstall) => wowInstall?.id)
  );

  public readonly selectedWowInstallationLabel$ = this._sessionService.selectedWowInstallation$.pipe(
    map((wowInstall) => wowInstall?.label ?? "")
  );

  public wowInstallations$: Observable<WowInstallation[]> = combineLatest([
    this._warcraftInstallationService.wowInstallations$,
    this._addonService.anyUpdatesAvailable$,
  ]).pipe(switchMap(([installations]) => this.mapInstallations(installations)));

  public constructor(
    private _addonService: AddonService,
    private _sessionService: SessionService,
    private _warcraftInstallationService: WarcraftInstallationService
  ) {}

  public ngOnInit(): void {}

  public async onClientChange(evt: any): Promise<void> {
    const val: string = evt.value.toString();
    await this._sessionService.setSelectedWowInstallation(val);
  }

  private async mapInstallations(installations: WowInstallation[]): Promise<WowInstallation[]> {
    let total = 0;
    for (const inst of installations) {
      const addons = await this._addonService.getAllAddonsAvailableForUpdate(inst);
      inst.availableUpdateCount = addons.length;
      total += inst.availableUpdateCount;
    }

    this.totalAvailableUpdateCt$.next(total);
    return installations;
  }
}
