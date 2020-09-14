import { Component, OnDestroy, OnInit } from '@angular/core';
import { WowClientType } from '../../models/warcraft/wow-client-type';
import { debounceTime, first, map, tap } from 'rxjs/operators';
import { from, BehaviorSubject, Observable, fromEvent, Subscription } from 'rxjs';
import { AddonTableColumnComponent } from '../../components/addon-table-column/addon-table-column.component';
import { AddonStatusColumnComponent } from '../../components/addon-status-column/addon-status-column.component';
import { Addon } from 'app/entities/addon';
import { WarcraftService } from 'app/services/warcraft/warcraft.service';
import { AddonService } from 'app/services/addons/addon.service';
import { SessionService } from 'app/services/session/session.service';
import { GridApi, GridOptions } from 'ag-grid-community';

@Component({
  selector: 'app-my-addons',
  templateUrl: './my-addons.component.html',
  styleUrls: ['./my-addons.component.scss']
})
export class MyAddonsComponent implements OnInit, OnDestroy {

  private readonly _displayAddonsSrc = new BehaviorSubject<Addon[]>([]);

  private gridApi: GridApi;
  private subscriptions: Subscription[] = [];

  gridOptions: GridOptions = {
    suppressMovableColumns: true,
    suppressDragLeaveHidesColumns: true,
  }

  defaultColDef = {
    wrapText: true,
    sortable: true,
    autoHeight: true,
  };

  columnDefs = [
    {
      headerName: 'Addon',
      field: 'name',
      cellRendererFramework: AddonTableColumnComponent,
      resizable: true,
      suppressMovable: true,
      suppressSizeToFit: true,
      minWidth: 200,
      flex: 1
    },
    {
      headerName: 'Status',
      field: 'value',
      cellRendererFramework: AddonStatusColumnComponent,
      width: 120,
      suppressSizeToFit: true,
    },
    {
      headerName: 'Latest Version', field: 'latestVersion', cellClass: 'cell-center-text', resizable: true
    },
    { headerName: 'Game Version', field: 'gameVersion', cellClass: 'cell-center-text', width: 100, suppressSizeToFit: true },
    { headerName: 'Author', field: 'author', cellClass: 'cell-center-text', flex: 1 }
  ];

  public selectedClient = WowClientType.None;
  public busy = false;
  public displayAddons$ = this._displayAddonsSrc.asObservable();

  constructor(
    public warcraftService: WarcraftService,
    private addonService: AddonService,
    private _sessionService: SessionService
  ) {
    this._sessionService.selectedHomeTab$
      .subscribe(index => {
        if (index !== 0) {
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
          this.loadAddons(this.selectedClient);
        })
      )
      .subscribe();

    const resizeSub = fromEvent(window, 'resize')
      .pipe(
        debounceTime(100),
        map(() => {
          this.gridApi.sizeColumnsToFit();
        })
      )
      .subscribe();

    this.subscriptions.push(resizeSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  onReScan() {
    this.loadAddons(this.selectedClient, true)
  }

  onClientChange() {
    this._sessionService.selectedClientType = this.selectedClient;
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

  private loadAddons(clientType: WowClientType, rescan = false) {
    this.busy = true;

    console.log('Load-addons', clientType);

    from(this.addonService.getAddons(clientType, rescan))
      .subscribe((addons) => {
        this.busy = false;
        this.formatAddons(addons);
        this._displayAddonsSrc.next(addons);
      });
  }

  private formatAddons(addons: Addon[]) {
    addons.forEach(addon => {
      if (!addon.thumbnailUrl) {
        addon.thumbnailUrl = 'assets/wowup_logo_512np.png';
      }
      if (!addon.installedVersion) {
        addon.installedVersion = 'None';
      }
    })
  }
}
