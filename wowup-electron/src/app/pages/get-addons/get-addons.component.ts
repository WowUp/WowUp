import { Component, OnInit } from '@angular/core';
import { WowClientType } from 'app/models/warcraft/wow-client-type';
import { ColumnState } from 'app/models/wowup/column-state';
import { PotentialAddon } from 'app/models/wowup/potential-addon';
import { ElectronService } from 'app/services';
import { AddonService } from 'app/services/addons/addon.service';
import { SessionService } from 'app/services/session/session.service';
import { WarcraftService } from 'app/services/warcraft/warcraft.service';
import { BehaviorSubject, fromEvent, Subscription } from 'rxjs';
import { debounceTime, map } from 'rxjs/operators';

@Component({
  selector: 'app-get-addons',
  templateUrl: './get-addons.component.html',
  styleUrls: ['./get-addons.component.scss']
})
export class GetAddonsComponent implements OnInit {
  private readonly _displayAddonsSrc = new BehaviorSubject<PotentialAddon[]>([]);

  private subscriptions: Subscription[] = [];

  columns: ColumnState[] = [
    { name: 'addon', display: 'Addon', visible: true },
    { name: 'author', display: 'Author', visible: true },
    { name: 'provider', display: 'Provider', visible: true },
    { name: 'status', display: 'Status', visible: true },
  ]

  public get displayedColumns(): string[] {
    return this.columns.filter(col => col.visible).map(col => col.name);
  }

  public query = '';
  public displayAddons$ = this._displayAddonsSrc.asObservable();
  public isBusy = false;
  public selectedClient = WowClientType.None;

  constructor(
    private _addonService: AddonService,
    private _sessionService: SessionService,
    public electronService: ElectronService,
    public warcraftService: WarcraftService
  ) {

  }

  ngOnInit(): void {
    this._sessionService.selectedClientType$
      .pipe(
        map(clientType => {
          this.selectedClient = clientType;
          this.loadPopularAddons(clientType);
        })
      )
      .subscribe();
  }

  onClientChange() {
    this._sessionService.selectedClientType = this.selectedClient;
  }

  onRefresh() {
    this.loadPopularAddons(this.selectedClient);
  }

  private async loadPopularAddons(clientType: WowClientType) {
    if (clientType === WowClientType.None) {
      return;
    }

    this.isBusy = true;

    this._addonService.getFeaturedAddons(clientType)
      .subscribe({
        next: (addons) => {
          // console.log('FEAT ADDONS', addons);
          addons = this.filterInstalledAddons(addons);
          this.formatAddons(addons);
          this._displayAddonsSrc.next(addons);
          this.isBusy = false;
        },
        error: (err) => {
          console.error(err);
        }
      });
  }

  private filterInstalledAddons(addons: PotentialAddon[]) {
    return addons.filter(addon => !this._addonService.isInstalled(addon.externalId, this._sessionService.selectedClientType));
  }

  private formatAddons(addons: PotentialAddon[]) {
    addons.forEach(addon => {
      if (!addon.thumbnailUrl) {
        addon.thumbnailUrl = 'assets/wowup_logo_512np.png';
      }
    })
  }
}
