import { Component, OnInit } from '@angular/core';
import { WarcraftService } from 'app/core/services/warcraft/warcraft.service';
import { WowClientType } from 'app/models/warcraft/wow-client-type';
import { AddonService } from 'app/core/services/addons/addon.service';
import { first, tap } from 'rxjs/operators';
import { from, BehaviorSubject } from 'rxjs';
import { Addon } from 'app/core/entities/addon';
import { AddonTableColumnComponent } from 'app/components/addon-table-column/addon-table-column.component';
import { AddonStatusColumnComponent } from 'app/components/addon-status-column/addon-status-column.component';

@Component({
  selector: 'app-my-addons',
  templateUrl: './my-addons.component.html',
  styleUrls: ['./my-addons.component.scss']
})
export class MyAddonsComponent implements OnInit {

  private readonly _displayAddonsSrc = new BehaviorSubject<Addon[]>([]);

  private gridApi;

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

  public selectedClient = WowClientType.Retail;
  public busy = false;
  public displayAddons$ = this._displayAddonsSrc.asObservable();

  constructor(
    public warcraftService: WarcraftService,
    private addonService: AddonService
  ) {

    this.warcraftService.clientTypes$
      .pipe(
        first(types => Array.isArray(types) && types.length > 0),
        tap(() => this.loadAddons())
      )
      .subscribe(types => this.selectedClient = types[0]);

  }

  ngOnInit(): void {
  }

  onReScan() {
    this.loadAddons(true)
  }

  onClientChange() {
    this.busy = true;
    console.log(this.selectedClient);
    this.busy = false;
  }

  onGridReady(params) {
    this.gridApi = params.api;
    this.gridApi.sizeColumnsToFit();

  }

  private loadAddons(rescan: boolean = false) {
    this.busy = true;

    console.log('Load-addons')

    from(this.addonService.getAddons(this.selectedClient, rescan))
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
