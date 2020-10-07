import { Overlay, OverlayRef } from "@angular/cdk/overlay";
import {
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewContainerRef,
} from "@angular/core";
import { MatCheckboxChange } from "@angular/material/checkbox";
import { MatDialog } from "@angular/material/dialog";
import { MatMenuTrigger } from "@angular/material/menu";
import { MatRadioChange } from "@angular/material/radio";
import { MatSort } from "@angular/material/sort";
import { MatTableDataSource } from "@angular/material/table";
import { AddonModel } from "app/business-objects/my-addons-list-item";
import { AddonDetailComponent } from "app/components/addon-detail/addon-detail.component";
import { ConfirmDialogComponent } from "app/components/confirm-dialog/confirm-dialog.component";
import { Addon } from "app/entities/addon";
import { AddonDisplayState } from "app/models/wowup/addon-display-state";
import { AddonUpdateEvent } from "app/models/wowup/addon-update-event";
import { ColumnState } from "app/models/wowup/column-state";
import { ElectronService } from "app/services";
import { AddonService } from "app/services/addons/addon.service";
import { SessionService } from "app/services/session/session.service";
import { WarcraftService } from "app/services/warcraft/warcraft.service";
import { getEnumName } from "app/utils/enum.utils";
import { stringIncludes } from "app/utils/string.utils";
import { BehaviorSubject, from, Subscription } from "rxjs";
import { map } from "rxjs/operators";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { TranslateService } from "@ngx-translate/core";
import * as _ from "lodash";

@Component({
  selector: "app-my-addons",
  templateUrl: "./my-addons.component.html",
  styleUrls: ["./my-addons.component.scss"],
})
export class MyAddonsComponent implements OnInit, OnDestroy {
  @ViewChild("addonContextMenuTrigger") contextMenu: MatMenuTrigger;
  @ViewChild("columnContextMenuTrigger") columnContextMenu: MatMenuTrigger;
  @ViewChild("updateAllContextMenuTrigger")
  updateAllContextMenu: MatMenuTrigger;
  @ViewChild(MatSort) sort: MatSort;

  private readonly _displayAddonsSrc = new BehaviorSubject<AddonModel[]>([]);

  private subscriptions: Subscription[] = [];

  public spinnerMessage = "Loading...";
  public contextMenuPosition = { x: "0px", y: "0px" };
  public columns: ColumnState[] = [
    { name: 'addon.name', display: 'Addon', visible: true },
    { name: 'addon.displayState', display: 'Status', visible: true },
    { name: 'addon.latestVersion', display: 'Latest Version', visible: true, allowToggle: true },
    { name: 'addon.gameVersion', display: 'Game Version', visible: true, allowToggle: true },
    { name: 'addon.author', display: 'Author', visible: true, allowToggle: true },
    { name: 'addon.provider', display: 'Provider', visible: true, allowToggle: true },
  ]
  public selectedClient = WowClientType.None;
  public wowClientType = WowClientType;
  public overlayRef: OverlayRef | null;
  public isBusy = true;
  public enableControls = true;
  public dataSource = new MatTableDataSource<AddonModel>([]);
  public filter = "";

  public get displayedColumns(): string[] {
    return this.columns.filter((col) => col.visible).map((col) => col.name);
  }

  public get selectedRows(): AddonModel[] {
    return this._displayAddonsSrc.value.filter(x => x.selected);
  }

  constructor(
    private addonService: AddonService,
    private _sessionService: SessionService,
    public electronService: ElectronService,
    public overlay: Overlay,
    public viewContainerRef: ViewContainerRef,
    public warcraftService: WarcraftService,
    private _ngZone: NgZone,
    private _dialog: MatDialog,
    private _translate: TranslateService
  ) {}

  ngOnInit(): void {
    const addonRemovedSubscription = this.addonService.addonRemoved$.subscribe(
      (addonId: string) => this.onAddonRemoved(addonId)
    );
    const selectedClientSubscription = this._sessionService.selectedClientType$
      .pipe(
        map((clientType) => {
          console.log(
            "MyAddonsComponent -> ngOnInit -> clientType",
            clientType
          );
          this.selectedClient = clientType;
          this.loadAddons(this.selectedClient);
        })
      )
      .subscribe();

    const displayAddonSubscription = this._displayAddonsSrc.subscribe(
      (items: AddonModel[]) => {
        this.dataSource.data = items;
        this.dataSource.sortingDataAccessor = _.get;
        this.dataSource.filterPredicate = (
          item: AddonModel,
          filter: string
        ) => {
          if (
            stringIncludes(item.addon.name, filter) ||
            stringIncludes(item.addon.latestVersion, filter) ||
            stringIncludes(item.addon.author, filter)
          ) {
            return true;
          }
          return false;
        };
        this.dataSource.sort = this.sort;
      }
    );

    this.subscriptions = [
      addonRemovedSubscription,
      selectedClientSubscription,
      displayAddonSubscription,
    ];
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  onRefresh(): void {
    this.loadAddons(this.selectedClient);
  }

  onRowClicked(event: MouseEvent, row: AddonModel, index: number): void {
    console.log(row.displayState);
    console.log("index clicked: " + index);

    if (event.ctrlKey) {
      row.selected = !row.selected;
      return;
    }

    const listItems: AddonModel[] = [...this._displayAddonsSrc.value];

    if (event.shiftKey) {
      const startIdx = listItems.findIndex((item) => item.selected);
      listItems.forEach((item, i) => {
        if (i >= startIdx && i <= index) {
          item.selected = true;
        } else {
          item.selected = false;
        }
      });
    } else {
      listItems.forEach((item, i) => {
        if (i === index) {
          item.selected = !item.selected;
        } else {
          item.selected = false;
        }
      });
    }

    this._ngZone.run(() => {
      this._displayAddonsSrc.next(listItems);
    });
  }

  filterAddons(): void {
    this.dataSource.filter = this.filter.trim().toLowerCase();
  }

  onClearFilter(): void {
    this.filter = "";
    this.filterAddons();
  }

  async onUpdateAll() {
    this.enableControls = false;

    try {
      const listItems = _.filter(
        this._displayAddonsSrc.value,
        (listItem) =>
          listItem.displayState === AddonDisplayState.Install ||
          listItem.displayState === AddonDisplayState.Update
      );

      for (const listItem of listItems) {
        await this.addonService.installAddon(listItem.addon.id);
      }
    } catch (err) {
      console.error(err);
    }

    this.enableControls = true;
  }

  async onUpdateAllRetailClassic() {
    await this.updateAllWithSpinner(
      WowClientType.Retail,
      WowClientType.Classic
    );
  }

  async onUpdateAllClients() {
    await this.updateAllWithSpinner(
      WowClientType.Retail,
      WowClientType.RetailPtr,
      WowClientType.Beta,
      WowClientType.ClassicPtr,
      WowClientType.Classic
    );
  }

  onHeaderContext(event: MouseEvent) {
    event.preventDefault();
    this.updateContextMenuPosition(event);
    this.columnContextMenu.menuData = {
      columns: this.columns.filter((col) => col.allowToggle),
    };
    this.columnContextMenu.menu.focusFirstItem("mouse");
    this.columnContextMenu.openMenu();
  }

  onCellContext(event: MouseEvent, listItem: AddonModel) {
    event.preventDefault();
    this.updateContextMenuPosition(event);
    this.contextMenu.menuData = { listItem: listItem };
    this.contextMenu.menu.focusFirstItem("mouse");
    this.contextMenu.openMenu();
  }

  onUpdateAllContext(event: MouseEvent) {
    event.preventDefault();
    this.updateContextMenuPosition(event);
    this.updateAllContextMenu.openMenu();
  }

  async onReInstallAddonClick(addon: Addon) {
    try {
      await this.addonService.installAddon(addon.id);
    } catch (err) {
      console.error(err);
    }
  }

  onUpdateAddon(listItem: AddonModel) {
    listItem.isInstalling = true;

    this.addonService.installAddon(listItem.addon.id);
  }

  onAddonUpdated(event: AddonUpdateEvent): void {
    console.log("MyAddonsComponent -> Update", event);
    let listItems: AddonModel[] = [...this._displayAddonsSrc.value];
    const listItemIdx = listItems.findIndex(
      (li) => li.addon.id === event.addon.id
    );
    const listItem = new AddonModel(event.addon);
    listItem.updateInstallState(event.installState);
    listItem.setStatusText(event.installState);
    listItem.installProgress = event.progress;

    if (listItemIdx === -1) {
      listItems.push(listItem);
    } else {
      listItems[listItemIdx] = listItem;
    }

    listItems = this.sortListItems(listItems);

    this._ngZone.run(() => {
      this._displayAddonsSrc.next(listItems);
    });
  }

  onAddonRemoved(addonId: string): void {
    const addons: AddonModel[] = [...this._displayAddonsSrc.value];
    const listItemIdx = addons.findIndex((li) => li.addon.id === addonId);
    addons.splice(listItemIdx, 1);

    this._ngZone.run(() => {
      this._displayAddonsSrc.next(addons);
    });
    this._dialog.closeAll();
  }

  public onColumnVisibleChange(event: MatCheckboxChange, column: ColumnState) {
    console.log("MyAddonsComponent -> onColumnVisibleChange", event, column);

    const col = this.columns.find((col) => col.name === column.name);
    col.visible = event.checked;
  }

  onReScan() {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Start re-scan?`,
        message: `Doing a re-scan may reset the addon information and attempt to re-guess what you have installed. This operation can take a moment.`,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }
      this.loadAddons(this.selectedClient, true);
    });
  }

  onClientChange(): void {
    this._sessionService.selectedClientType = this.selectedClient;
  }

  onRemoveAddonClick(addon: Addon) {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title:  this._translate.instant('DIALOGS.REMOVE_ADDON.TITLE'),
        message: this._translate.instant('DIALOGS.REMOVE_ADDON.MESSAGE', { addon: addon.name })
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      console.log("The dialog was closed", result);
      if (!result) {
        return;
      }

      this.addonService.removeAddon(addon);
    });
  }

  onClickIgnoreAddon(evt: MatCheckboxChange, listItem: AddonModel) {
    listItem.addon.isIgnored = evt.checked;
    listItem.statusText = listItem.getDisplayStateText();
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

  openDetailDialog(addon: Addon) {
    const dialogRef = this._dialog.open(AddonDetailComponent, {
      data: addon,
    });

    dialogRef.afterClosed().subscribe();
  }

  private async updateAllWithSpinner(...clientTypes: WowClientType[]) {
    this.isBusy = true;
    this.spinnerMessage = "Gathering addons...";

    try {
      let updatedCt = 0;
      let addons: Addon[] = [];
      for (const clientType of clientTypes) {
        addons = addons.concat(await this.addonService.getAddons(clientType));
      }

      // Only care about the ones that need to be updated/installed
      addons = addons
        .map((addon) => new AddonModel(addon))
        .filter((listItem) => listItem.needsUpdate || listItem.needsInstall)
        .map((listItem) => listItem.addon);

      this.spinnerMessage = `Updating ${updatedCt}/${addons.length}`;

      for (const addon of addons) {
        updatedCt += 1;
        this.spinnerMessage = `Updating ${updatedCt}/${
          addons.length
        }\n${getEnumName(WowClientType, addon.clientType)}: ${addon.name}`;

        await this.addonService.installAddon(addon.id);
      }

      this.loadAddons(this.selectedClient);
    } catch (err) {
      console.error("Failed to update classic/retail", err);
      this.isBusy = false;
    }
  }

  private updateContextMenuPosition(event: MouseEvent) {
    this.contextMenuPosition.x = event.clientX.toString + "px";
    this.contextMenuPosition.y = event.clientY + "px";
  }

  private loadAddons(clientType: WowClientType, rescan = false) {
    this.isBusy = true;
    this.enableControls = false;

    console.log("Load-addons", clientType);

    from(this.addonService.getAddons(clientType, rescan)).subscribe({
      next: (addons) => {
        this.isBusy = false;
        this.enableControls = true;
        this._ngZone.run(() => {
          this._sessionService.contextText = `${addons.length} addons`;
          this._displayAddonsSrc.next(this.formatAddons(addons));
        });
      },
      error: (err) => {
        console.error(err);
        this.isBusy = false;
        this.enableControls = true;
      },
    });
  }

  private formatAddons(addons: Addon[]): AddonModel[] {
    const listItems = addons.map((addon) => new AddonModel(addon));
    return this.sortListItems(listItems);
  }

  private sortListItems(listItems: AddonModel[]) {
    return _.orderBy(listItems, ["displayState", "addon.name"]);
  }
}
