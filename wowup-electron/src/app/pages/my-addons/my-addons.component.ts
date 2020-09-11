import { Component, OnDestroy, OnInit } from '@angular/core';
import { WowClientType } from '../../models/warcraft/wow-client-type';
import { debounceTime, first, map, tap } from 'rxjs/operators';
import { from, BehaviorSubject, Observable, fromEvent, Subscription } from 'rxjs';
import { AddonTableColumnComponent } from '../../components/addon-table-column/addon-table-column.component';
import { AddonStatusColumnComponent } from '../../components/addon-status-column/addon-status-column.component';
import { Addon } from 'app/entities/addon';
import { WarcraftService } from 'app/services/warcraft/warcraft.service';
import { AddonService } from 'app/services/addons/addon.service';

@Component({
  selector: 'app-my-addons',
  templateUrl: './my-addons.component.html',
  styleUrls: ['./my-addons.component.scss']
})
export class MyAddonsComponent implements OnInit, OnDestroy {

  private readonly _displayAddonsSrc = new BehaviorSubject<Addon[]>([]);

  private gridApi;
  private subscriptions: Subscription[] = [];

  public displayedColumns: string[] = [
    'addon',
    'status',
    'latest-version',
    'game-version',
    'author'
  ];

  gridOptions = {
    autoHeight: true
  }

  columnDefs = [
    {
      headerName: 'Addon',
      field: 'value',
      cellRendererFramework: AddonTableColumnComponent,
      autoHeight: true,
      suppressSizeToFit: true,
      width: 400
    },
    {
      headerName: 'Status',
      field: 'value',
      cellRendererFramework: AddonStatusColumnComponent,
      width: 80,
      suppressSizeToFit: true,
    },
    { headerName: 'Latest Version', field: 'latestVersion', cellClass: 'cell-wrap-text ' },
    { headerName: 'Game Version', field: 'gameVersion' },
    { headerName: 'Author', field: 'author', cellClass: 'cell-wrap-text' }
  ];

  public dataSource = [
    { position: 1, name: 'Hydrogen', weight: 1.0079, symbol: 'H' },
    { position: 2, name: 'Helium', weight: 4.0026, symbol: 'He' },
    { position: 3, name: 'Lithium', weight: 6.941, symbol: 'Li' },
    { position: 4, name: 'Beryllium', weight: 9.0122, symbol: 'Be' },
    { position: 5, name: 'Boron', weight: 10.811, symbol: 'B' },
    { position: 6, name: 'Carbon', weight: 12.0107, symbol: 'C' },
    { position: 7, name: 'Nitrogen', weight: 14.0067, symbol: 'N' },
    { position: 8, name: 'Oxygen', weight: 15.9994, symbol: 'O' },
    { position: 9, name: 'Fluorine', weight: 18.9984, symbol: 'F' },
    { position: 10, name: 'Neon', weight: 20.1797, symbol: 'Ne' },
  ];

  public selectedClient = WowClientType.Classic;
  public busy = false;
  public displayAddons$ = this._displayAddonsSrc.asObservable();

  constructor(
    public warcraftService: WarcraftService,
    private addonService: AddonService
  ) {

    this.warcraftService.clientTypes$
      .pipe(
        first(types => Array.isArray(types) && types.length > 0),
        tap(() => this.loadAddons(this.selectedClient))
      )
      .subscribe(types => this.selectedClient = types[0]);

  }

  ngOnInit(): void {
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
    this.loadAddons(this.selectedClient, false);
  }

  onGridReady(params) {
    this.gridApi = params.api;
    this.gridApi.sizeColumnsToFit();
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
