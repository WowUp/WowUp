import { Component, NgZone, OnDestroy, OnInit, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { WowClientType } from '../../models/warcraft/wow-client-type';
import { debounceTime, filter, first, map, take, tap } from 'rxjs/operators';
import { from, BehaviorSubject, Observable, fromEvent, Subscription } from 'rxjs';
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
import * as _ from 'lodash';
import { ElectronService } from 'app/services';
import { AddonDisplayState } from 'app/models/wowup/addon-display-state';
import { AddonInstallState } from 'app/models/wowup/addon-install-state';

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
  public enableControls = true;

  constructor(
    private addonService: AddonService,
    private _sessionService: SessionService,
    public electronService: ElectronService,
    public overlay: Overlay,
    public viewContainerRef: ViewContainerRef,
    public warcraftService: WarcraftService,
    private _ngZone: NgZone
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
      });

    this.addonService.addonInstalled$.subscribe((evt) => {
      console.log('UPDATE')
      const addons = [].concat(this._displayAddonsSrc.value);
      const listItemIdx = addons.findIndex(li => li.id === evt.addon.id);
      const listItem = new MyAddonsListItem(evt.addon);
      listItem.isInstalling = evt.installState === AddonInstallState.Installing || evt.installState === AddonInstallState.Downloading;
      listItem.statusText = this.getInstallStateText(evt.installState);
      listItem.installProgress = evt.progress;

      console.log(listItem);
      addons[listItemIdx] = listItem;
      this._ngZone.run(() => {
        this._displayAddonsSrc.next(addons);
      });
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

  async onUpdateAll() {
    this.enableControls = false;

    try {
      const listItems = _.filter(this._displayAddonsSrc.value,
        listItem => listItem.displayState === AddonDisplayState.Install || listItem.displayState === AddonDisplayState.Update);

      for (let listItem of listItems) {
        await this.addonService.installAddon(listItem.id,)
      }
    } catch (err) {
      console.error(err);
    }

    this.enableControls = true;
  }

  onHeaderContext({ x, y }: MouseEvent) {
    this.showContextMenu(x, y, this.columnMenu, this.displayedColumns);
  }

  onCellContext({ x, y }: MouseEvent, addon: Addon) {
    this.showContextMenu(x, y, this.addonMenu, addon);
  }

  onUpdateAddon(listItem: MyAddonsListItem) {
    listItem.isInstalling = true;

    this.addonService.installAddon(listItem.id);
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
    this.enableControls = false;

    console.log('Load-addons', clientType);

    from(this.addonService.getAddons(clientType, rescan))
      .subscribe({
        next: (addons) => {
          this.isBusy = false;
          this.enableControls = true;
          this._displayAddonsSrc.next(this.formatAddons(addons));
        },
        error: (err) => {
          this.isBusy = false;
          this.enableControls = true;
        }
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

  private getInstallStateText(installState: AddonInstallState) {
    switch (installState) {
      case AddonInstallState.Pending:
        return "Pending";
      case AddonInstallState.Downloading:
        return "Downloading";
      case AddonInstallState.BackingUp:
        return "BackingUp";
      case AddonInstallState.Installing:
        return "Installing";
      case AddonInstallState.Complete:
        return "Complete";
      default:
        return "Unknown";
    }
  }
}
