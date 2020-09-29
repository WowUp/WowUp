import { Component, NgZone, OnDestroy, OnInit, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { WowClientType } from '../../models/warcraft/wow-client-type';
import { debounceTime, filter, first, map, take, tap } from 'rxjs/operators';
import { from, BehaviorSubject, Observable, fromEvent, Subscription } from 'rxjs';
import { Addon } from 'app/entities/addon';
import { WarcraftService } from 'app/services/warcraft/warcraft.service';
import { AddonService } from 'app/services/addons/addon.service';
import { SessionService } from 'app/services/session/session.service';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ColumnState } from 'app/models/wowup/column-state';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { MyAddonsListItem } from 'app/business-objects/my-addons-list-item';
import * as _ from 'lodash';
import { ElectronService } from 'app/services';
import { AddonDisplayState } from 'app/models/wowup/addon-display-state';
import { AddonInstallState } from 'app/models/wowup/addon-install-state';
import { MatMenuTrigger } from '@angular/material/menu';
import { MatRadioChange } from '@angular/material/radio';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from 'app/components/confirm-dialog/confirm-dialog.component';
import { getEnumName } from 'app/utils/enum.utils';

@Component({
  selector: 'app-my-addons',
  templateUrl: './my-addons.component.html',
  styleUrls: ['./my-addons.component.scss']
})
export class MyAddonsComponent implements OnInit, OnDestroy {

  @ViewChild('addonContextMenuTrigger') contextMenu: MatMenuTrigger;
  @ViewChild('columnContextMenuTrigger') columnContextMenu: MatMenuTrigger;
  @ViewChild('updateAllContextMenuTrigger') updateAllContextMenu: MatMenuTrigger;

  private readonly _displayAddonsSrc = new BehaviorSubject<MyAddonsListItem[]>([]);

  private subscriptions: Subscription[] = [];
  private sub: Subscription;

  public spinnerMessage = 'Loading...';

  contextMenuPosition = { x: '0px', y: '0px' };

  columns: ColumnState[] = [
    { name: 'addon', display: 'Addon', visible: true },
    { name: 'status', display: 'Status', visible: true },
    { name: 'latestVersion', display: 'Latest Version', visible: true, allowToggle: true },
    { name: 'gameVersion', display: 'Game Version', visible: true, allowToggle: true },
    { name: 'provider', display: 'Provider', visible: true, allowToggle: true },
    { name: 'author', display: 'Author', visible: true, allowToggle: true },
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
    private _ngZone: NgZone,
    private _dialog: MatDialog
  ) {

    this.addonService.addonInstalled$.subscribe((evt) => {
      console.log('UPDATE')
      let listItems: MyAddonsListItem[] = [].concat(this._displayAddonsSrc.value);
      const listItemIdx = listItems.findIndex(li => li.addon.id === evt.addon.id);
      const listItem = this.createAddonListItem(evt.addon);
      listItem.isInstalling = evt.installState === AddonInstallState.Installing || evt.installState === AddonInstallState.Downloading;
      listItem.statusText = this.getInstallStateText(evt.installState);
      listItem.installProgress = evt.progress;

      if (listItemIdx === -1) {
        listItems.push(listItem);
      } else {
        listItems[listItemIdx] = listItem;
      }

      listItems = this.sortListItems(listItems);

      this._ngZone.run(() => {
        this._displayAddonsSrc.next(listItems);
      });
    });

    this.addonService.addonRemoved$
      .subscribe((addonId) => {
        const addons: MyAddonsListItem[] = [].concat(this._displayAddonsSrc.value);
        const listItemIdx = addons.findIndex(li => li.addon.id === addonId);
        addons.splice(listItemIdx, 1);

        this._ngZone.run(() => {
          this._displayAddonsSrc.next(addons);
        });
      })
  }

  ngOnInit(): void {
    this._sessionService.selectedClientType$
      .pipe(
        map(clientType => {
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

  async onUpdateAllRetailClassic() {
    await this.updateAllWithSpinner(WowClientType.Retail, WowClientType.Classic);
  }

  async onUpdateAllClients() {
    await this.updateAllWithSpinner(WowClientType.Retail, WowClientType.RetailPtr, WowClientType.Beta, WowClientType.ClassicPtr, WowClientType.Classic);
  }

  onHeaderContext(event: MouseEvent) {
    event.preventDefault();
    this.updateContextMenuPosition(event);
    this.columnContextMenu.menuData = { 'columns': this.columns.filter(col => col.allowToggle) };
    this.columnContextMenu.menu.focusFirstItem('mouse');
    this.columnContextMenu.openMenu();
  }

  onCellContext(event: MouseEvent, listItem: MyAddonsListItem) {
    event.preventDefault();
    this.updateContextMenuPosition(event);
    this.contextMenu.menuData = { 'listItem': listItem };
    this.contextMenu.menu.focusFirstItem('mouse');
    this.contextMenu.openMenu();
  }

  onUpdateAllContext(event: MouseEvent) {
    event.preventDefault();
    this.updateContextMenuPosition(event);
    this.updateAllContextMenu.openMenu();
  }

  async onReInstallAddon(addon: Addon) {
    try {
      this.addonService.installAddon(addon.id);
    } catch (err) {
      console.error(err);
    }
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
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Start re-scan?`,
        message: `Doing a re-scan may reset the addon information and attempt to re-guess what you have installed. This operation can take a moment.`
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) {
        return;
      }
      this.loadAddons(this.selectedClient, true)
    });
  }

  onClientChange() {
    this._sessionService.selectedClientType = this.selectedClient;
  }

  onRemoveAddon(addon: Addon) {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Uninstall Addon?`,
        message: `Are you sure you want to remove ${addon.name}?\nThis will remove all related folders from your World of Warcraft folder.`
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed', result);
      if (!result) {
        return;
      }

      this.addonService.removeAddon(addon);
    });
  }

  onInstall() {

  }

  onClickIgnoreAddon(evt: MatCheckboxChange, listItem: MyAddonsListItem) {
    listItem.addon.isIgnored = evt.checked;
    listItem.statusText = listItem.getStateText();
    this.addonService.saveAddon(listItem.addon);
  }

  onClickAutoUpdateAddon(evt: MatCheckboxChange, addon: Addon) {
    addon.autoUpdateEnabled = evt.checked;
    this.addonService.saveAddon(addon);
  }

  onSelectedAddonChannelChange(evt: MatRadioChange, addon: Addon) {
    addon.channelType = evt.value;
    this.addonService.saveAddon(addon);
    this.loadAddons(this.selectedClient);
  }

  private async updateAllWithSpinner(...clientTypes: WowClientType[]) {
    this.isBusy = true;
    this.spinnerMessage = 'Gathering addons...';

    try {
      let updatedCt = 0;
      let addons: Addon[] = [];
      for (let clientType of clientTypes) {
        addons = addons.concat(await this.addonService.getAddons(clientType));
      }

      // Only care about the ones that need to be updated/installed
      addons = addons
        .map(addon => new MyAddonsListItem(addon))
        .filter(listItem => listItem.needsUpdate || listItem.needsInstall)
        .map(listItem => listItem.addon);

      this.spinnerMessage = `Updating ${updatedCt}/${addons.length}`;

      for (let addon of addons) {
        updatedCt += 1;
        this.spinnerMessage = `Updating ${updatedCt}/${addons.length}\n${getEnumName(WowClientType, addon.clientType)}: ${addon.name}`;

        await this.addonService.installAddon(addon.id);
      }

      this.loadAddons(this.selectedClient);
    } catch (err) {
      console.error('Failed to update classic/retail', err);
      this.isBusy = false;
    }
  }

  private updateContextMenuPosition(event: MouseEvent) {
    this.contextMenuPosition.x = event.clientX + 'px';
    this.contextMenuPosition.y = event.clientY + 'px';
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
          this._ngZone.run(() => {
            this._displayAddonsSrc.next(this.formatAddons(addons));
          });
        },
        error: (err) => {
          this.isBusy = false;
          this.enableControls = true;
        }
      });
  }

  private formatAddons(addons: Addon[]): MyAddonsListItem[] {
    const listItems = addons.map(addon => this.createAddonListItem(addon));

    return this.sortListItems(listItems);
  }

  private sortListItems(listItems: MyAddonsListItem[]) {
    return _.orderBy(listItems, ['displayState', 'addon.name']);
  }

  private createAddonListItem(addon: Addon) {
    const listItem = new MyAddonsListItem(addon);

    if (!listItem.addon.thumbnailUrl) {
      listItem.addon.thumbnailUrl = 'assets/wowup_logo_512np.png';
    }
    if (!listItem.addon.installedVersion) {
      listItem.addon.installedVersion = 'None';
    }

    return listItem;
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
