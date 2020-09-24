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
import { MatMenuTrigger } from '@angular/material/menu';
import { MatRadioChange } from '@angular/material/radio';

@Component({
  selector: 'app-my-addons',
  templateUrl: './my-addons.component.html',
  styleUrls: ['./my-addons.component.scss']
})
export class MyAddonsComponent implements OnInit, OnDestroy {

  @ViewChild('columnMenu') columnMenu: TemplateRef<any>;
  @ViewChild('addonMenu') addonMenu: TemplateRef<any>;
  @ViewChild(MatMenuTrigger)
  contextMenu: MatMenuTrigger;

  private readonly _displayAddonsSrc = new BehaviorSubject<MyAddonsListItem[]>([]);

  private gridApi: GridApi;
  private subscriptions: Subscription[] = [];
  private sub: Subscription;

  contextMenuPosition = { x: '0px', y: '0px' };

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
      const addons: MyAddonsListItem[] = [].concat(this._displayAddonsSrc.value);
      const listItemIdx = addons.findIndex(li => li.addon.id === evt.addon.id);
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
        await this.addonService.installAddon(listItem.addon.id,)
      }
    } catch (err) {
      console.error(err);
    }

    this.enableControls = true;
  }

  onHeaderContext({ x, y }: MouseEvent) {
    this.showContextMenu(x, y, this.columnMenu, this.displayedColumns);
  }

  onCellContext(event: MouseEvent, listItem: MyAddonsListItem) {
    console.log(listItem)
    event.preventDefault();
    this.contextMenuPosition.x = event.clientX + 'px';
    this.contextMenuPosition.y = event.clientY + 'px';
    this.contextMenu.menuData = { 'listItem': listItem };
    this.contextMenu.menu.focusFirstItem('mouse');
    this.contextMenu.openMenu();

    // this.showContextMenu(event.x, event.y, this.addonMenu, addon);
  }

  onUpdateAddon(listItem: MyAddonsListItem) {
    listItem.isInstalling = true;

    this.addonService.installAddon(listItem.addon.id);
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

  onClickIgnoreAddon(evt: MatCheckboxChange, listItem: MyAddonsListItem) {
    listItem.addon.isIgnored = evt.checked;
    listItem.statusText = listItem.getStateText();
    this.addonService.saveAddon(listItem.addon);
  }

  onClickAutoUpdateAddon(evt: MatCheckboxChange, addon: Addon){
    addon.autoUpdateEnabled = evt.checked;
    this.addonService.saveAddon(addon);
  }

  onSelectedAddonChannelChange(evt: MatRadioChange, addon: Addon) {
    addon.channelType = evt.value;
    this.addonService.saveAddon(addon);
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

      if (!listItem.addon.thumbnailUrl) {
        listItem.addon.thumbnailUrl = 'assets/wowup_logo_512np.png';
      }
      if (!listItem.addon.installedVersion) {
        listItem.addon.installedVersion = 'None';
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
