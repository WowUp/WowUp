import { Component, NgZone, OnDestroy, OnInit, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { WowClientType } from '../../models/warcraft/wow-client-type';
import { debounceTime, filter, first, map, take, tap } from 'rxjs/operators';
import { from, BehaviorSubject, Observable, fromEvent, Subscription } from 'rxjs';
import { AddonTableColumnComponent } from '../../components/addon-table-column/addon-table-column.component';
import { AddonStatusColumnComponent } from '../../components/addon-status-column/addon-status-column.component';
import { Addon } from 'app/entities/addon';
import { WarcraftService } from 'app/services/warcraft/warcraft.service';
import { AddonService } from 'app/services/addons/addon.service';
import { SessionService } from 'app/services/session/session.service';
import { GridApi, GridOptions } from 'ag-grid-community';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { ColumnState } from 'app/models/wowup/column-state';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { MyAddonsListItem } from 'app/business-objects/my-addons-list-item';
import { AddonDisplayState } from 'app/models/wowup/addon-display-state';
import * as _ from 'lodash';
import { ElectronService } from 'app/services';

@Component({
  selector: 'app-my-addons',
  templateUrl: './my-addons.component.html',
  styleUrls: ['./my-addons.component.scss']
})
export class MyAddonsComponent implements OnInit, OnDestroy {

  @ViewChild('columnMenu') columnMenu: TemplateRef<any>;
  @ViewChild('addonMenu') addonMenu: TemplateRef<any>;

  private readonly _displayAddonsSrc = new BehaviorSubject<MyAddonsListItem[]>([]);

  private gridApi: GridApi;
  private subscriptions: Subscription[] = [];
  private sub: Subscription;

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
      headerName: 'Latest Version',
      field: 'latestVersion',
      cellClass: 'cell-center-text',
      suppressSizeToFit: true,
      resizable: true
    },
    {
      headerName: 'Game Version',
      field: 'gameVersion',
      cellClass: 'cell-center-text',
      width: 100,
      suppressSizeToFit: true
    },
    {
      headerName: 'Author',
      field: 'author',
      cellClass: 'cell-center-text',
      width: 100,
    }
  ];

  columns: ColumnState[] = [
    { name: 'addon', display: 'Addon', visible: true },
    { name: 'status', display: 'Status', visible: true },
    { name: 'latestVersion', display: 'Latest Version', visible: true },
    { name: 'gameVersion', display: 'Game Version', visible: true },
    { name: 'provider', display: 'Provider', visible: true },
    { name: 'author', display: 'Author', visible: true },
  ]

  public get displayedColumns(): string[] {
    return this.columns.filter(col => col.visible).map(col => col.name);
  }

  public selectedClient = WowClientType.None;
  public displayAddons$ = this._displayAddonsSrc.asObservable();
  public overlayRef: OverlayRef | null;
  public isBusy = true;

  constructor(
    private addonService: AddonService,
    private _sessionService: SessionService,
    public electronService: ElectronService,
    public overlay: Overlay,
    public viewContainerRef: ViewContainerRef,
    public warcraftService: WarcraftService
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
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  onRefresh() {
    this.loadAddons(this.selectedClient);
  }

  onHeaderContext({ x, y }: MouseEvent) {
    this.showContextMenu(x, y, this.columnMenu, this.displayedColumns);
  }

  onCellContext({ x, y }: MouseEvent, addon: Addon) {
    this.showContextMenu(x, y, this.addonMenu, addon);
  }

  public onColumnVisibleChange(event: MatCheckboxChange, column: ColumnState) {
    console.log(event, column);

    const col = this.columns.find(col => col.name === column.name);
    col.visible = event.checked;
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

  private showContextMenu(x: number, y: number, template: TemplateRef<any>, data: any) {
    this.closeContext();

    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo({ x, y })
      .withPositions([
        {
          originX: 'end',
          originY: 'bottom',
          overlayX: 'end',
          overlayY: 'top',
        }
      ]);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.close()
    });

    this.overlayRef.attach(new TemplatePortal(template, this.viewContainerRef, {
      $implicit: data
    }));

    this.sub = fromEvent<MouseEvent>(document, 'click')
      .pipe(
        filter(event => {
          const clickTarget = event.target as HTMLElement;
          return !!this.overlayRef && !this.overlayRef.overlayElement.contains(clickTarget);
        }),
        take(1)
      ).subscribe(() => this.closeContext())
  }

  private closeContext() {
    this.sub && this.sub.unsubscribe();
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }
  }

  private loadAddons(clientType: WowClientType, rescan = false) {
    this.isBusy = true;

    console.log('Load-addons', clientType);

    from(this.addonService.getAddons(clientType, rescan))
      .subscribe((addons) => {
        this.isBusy = false;
        this._displayAddonsSrc.next(this.formatAddons(addons));
      });
  }

  private formatAddons(addons: Addon[]): MyAddonsListItem[] {
    const listItems = addons.map(addon => {
      const listItem = new MyAddonsListItem(addon);

      if (!listItem.thumbnailUrl) {
        listItem.thumbnailUrl = 'assets/wowup_logo_512np.png';
      }
      if (!listItem.installedVersion) {
        listItem.installedVersion = 'None';
      }

      return listItem;
    });

    return _.sortBy(listItems, ['displayState', 'name']);
  }
}
