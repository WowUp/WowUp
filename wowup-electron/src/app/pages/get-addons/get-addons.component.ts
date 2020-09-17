import { Component, OnInit } from '@angular/core';
import { GridApi, GridOptions } from 'ag-grid-community';
import { AddonStatusColumnComponent } from 'app/components/addon-status-column/addon-status-column.component';
import { AddonTableColumnComponent } from 'app/components/addon-table-column/addon-table-column.component';
import { PotentialAddonStatusColumnComponent } from 'app/components/potential-addon-status-column/potential-addon-status-column.component';
import { PotentialAddonTableColumnComponent } from 'app/components/potential-addon-table-column/potential-addon-table-column.component';
import { WowClientType } from 'app/models/warcraft/wow-client-type';
import { PotentialAddon } from 'app/models/wowup/potential-addon';
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

  private gridApi: GridApi;
  private subscriptions: Subscription[] = [];

  gridOptions: GridOptions = {
    suppressMovableColumns: true,
    suppressDragLeaveHidesColumns: true,
    rowBuffer: 500
  }

  defaultColDef = {
    wrapText: true,
    sortable: true,
    autoHeight: true
  };

  columnDefs = [
    {
      headerName: 'Addon',
      field: 'name',
      cellRendererFramework: PotentialAddonTableColumnComponent,
      suppressSizeToFit: true,
      resizable: true,
      minWidth: 200,
      flex: 1
    },
    { headerName: 'Author', field: 'author', cellClass: 'cell-center-text', flex: 1 },
    { headerName: 'Provider', field: 'providerName', cellClass: 'cell-center-text', width: 100, suppressSizeToFit: true },
    {
      headerName: 'Status',
      field: 'value',
      sortable: false,
      cellRendererFramework: PotentialAddonStatusColumnComponent,
      width: 120,
      suppressSizeToFit: true,
    },
  ];

  public query = '';
  public displayAddons$ = this._displayAddonsSrc.asObservable();
  public isBusy = false;
  public selectedClient = WowClientType.None;

  constructor(
    private _addonService: AddonService,
    private _sessionService: SessionService,
    public warcraftService: WarcraftService
  ) {
    this._sessionService.selectedHomeTab$
      .subscribe(index => {
        if (index !== 1) {
          return;
        }
        window.setTimeout(() => {
          this.gridApi?.sizeColumnsToFit();
          this.gridApi?.resetRowHeights();
        }, 100);
      })
  }

  ngOnInit(): void {
    this._sessionService.selectedClientType$
      .pipe(
        map(clientType => {
          console.log('SEL', clientType)
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

  onGridReady(params) {
    this.gridApi = params.api;
    this.gridApi.sizeColumnsToFit();

    // simple resize debouncer
    let resizeTime = 0;
    this.gridApi.addEventListener('columnResized', () => {
      clearTimeout(resizeTime);
      resizeTime = window.setTimeout(() => {
        this.gridApi?.resetRowHeights();
      }, 100);
    });
  }

  private async loadPopularAddons(clientType: WowClientType) {
    if (clientType === WowClientType.None) {
      return;
    }

    this.isBusy = true;

    this._addonService.getFeaturedAddons(clientType)
      .subscribe({
        next: (addons) => {
          console.log('FEAT ADDONS', addons);
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
