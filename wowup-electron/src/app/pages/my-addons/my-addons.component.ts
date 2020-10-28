import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { map } from "rxjs/operators";
import { from, BehaviorSubject, Subscription } from "rxjs";
import { Addon } from "../../entities/addon";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { AddonService } from "../../services/addons/addon.service";
import { SessionService } from "../../services/session/session.service";
import { Overlay, OverlayRef } from "@angular/cdk/overlay";
import { ColumnState } from "../../models/wowup/column-state";
import { MatCheckboxChange } from "@angular/material/checkbox";
import { AddonViewModel } from "../../business-objects/my-addon-list-item";
import * as _ from "lodash";
import { ElectronService } from "../../services";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { MatMenuTrigger } from "@angular/material/menu";
import { MatRadioChange } from "@angular/material/radio";
import { MatDialog } from "@angular/material/dialog";
import { ConfirmDialogComponent } from "../../components/confirm-dialog/confirm-dialog.component";
import { getEnumName } from "../../utils/enum.utils";
import { MatTableDataSource } from "@angular/material/table";
import { MatSort } from "@angular/material/sort";
import { stringIncludes } from "../../utils/string.utils";
import {
  AddonDetailComponent,
  AddonDetailModel,
} from "../../components/addon-detail/addon-detail.component";
import { TranslateService } from "@ngx-translate/core";

@Component({
  selector: "app-my-addons",
  templateUrl: "./my-addons.component.html",
  styleUrls: ["./my-addons.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyAddonsComponent implements OnInit, OnDestroy {
  @Input("tabIndex") tabIndex: number;

  @ViewChild("addonContextMenuTrigger") contextMenu: MatMenuTrigger;
  @ViewChild("addonMultiContextMenuTrigger") multiContextMenu: MatMenuTrigger;
  @ViewChild("columnContextMenuTrigger") columnContextMenu: MatMenuTrigger;
  @ViewChild("updateAllContextMenuTrigger")
  updateAllContextMenu: MatMenuTrigger;
  @ViewChild(MatSort) sort: MatSort;

  private readonly _displayAddonsSrc = new BehaviorSubject<AddonViewModel[]>(
    []
  );

  private subscriptions: Subscription[] = [];
  private isSelectedTab: boolean = false;

  public sortedListItems: AddonViewModel[] = [];

  public spinnerMessage = "";

  public contextMenuPosition = { x: "0px", y: "0px" };

  public dataSource = new MatTableDataSource<AddonViewModel>([]);
  public filter = "";

  columns: ColumnState[] = [
    { name: "addon.name", display: "Addon", visible: true },
    { name: "sortOrder", display: "Status", visible: true },
    {
      name: "installedAt",
      display: "Updated At",
      visible: true,
      allowToggle: true,
    },
    {
      name: "addon.latestVersion",
      display: "Latest Version",
      visible: true,
      allowToggle: true,
    },
    {
      name: "addon.releasedAt",
      display: "Released At",
      visible: true,
      allowToggle: true,
    },
    {
      name: "addon.gameVersion",
      display: "Game Version",
      visible: true,
      allowToggle: true,
    },
    {
      name: "addon.providerName",
      display: "Provider",
      visible: true,
      allowToggle: true,
    },
    {
      name: "addon.author",
      display: "Author",
      visible: true,
      allowToggle: true,
    },
  ];

  public get displayedColumns(): string[] {
    return this.columns.filter((col) => col.visible).map((col) => col.name);
  }

  public selectedClient = WowClientType.None;
  public wowClientType = WowClientType;
  public overlayRef: OverlayRef | null;
  public isBusy = true;
  public enableControls = true;

  constructor(
    private addonService: AddonService,
    private _sessionService: SessionService,
    private _ngZone: NgZone,
    private _dialog: MatDialog,
    private _cdRef: ChangeDetectorRef,
    private _translateService: TranslateService,
    public electronService: ElectronService,
    public overlay: Overlay,
    public warcraftService: WarcraftService
  ) {
    _sessionService.selectedHomeTab$.subscribe((tabIndex) => {
      this.isSelectedTab = tabIndex === this.tabIndex;
      if (this.isSelectedTab) {
        this.setPageContextText();
      }
    });

    const addonInstalledSubscription = this.addonService.addonInstalled$.subscribe(
      (evt) => {
        let listItems: AddonViewModel[] = [].concat(
          this._displayAddonsSrc.value
        );
        const listItemIdx = listItems.findIndex(
          (li) => li.addon.id === evt.addon.id
        );
        const listItem = this.createAddonListItem(evt.addon);
        listItem.isInstalling =
          evt.installState === AddonInstallState.Installing ||
          evt.installState === AddonInstallState.Downloading;
        listItem.stateTextTranslationKey = this.getInstallStateTextTranslationKey(
          evt.installState
        );
        listItem.installProgress = evt.progress;
        listItem.installState = evt.installState;
        if (listItemIdx !== -1) {
          listItems[listItemIdx] = listItem;
        } else {
          listItems.push(listItem);
          listItems = this.sortListItems(listItems);
        }
        this._ngZone.run(() => {
          this._displayAddonsSrc.next(listItems);
        });
      }
    );

    const addonRemovedSubscription = this.addonService.addonRemoved$.subscribe(
      (addonId) => {
        const addons: AddonViewModel[] = [].concat(
          this._displayAddonsSrc.value
        );
        const listItemIdx = addons.findIndex((li) => li.addon.id === addonId);
        addons.splice(listItemIdx, 1);

        this._ngZone.run(() => {
          this._displayAddonsSrc.next(addons);
        });
      }
    );

    const displayAddonSubscription = this._displayAddonsSrc.subscribe(
      (items: AddonViewModel[]) => {
        this.dataSource.data = items;
        this.dataSource.sortingDataAccessor = _.get;
        this.dataSource.filterPredicate = this.filterListItem;
        this.dataSource.sort = this.sort;
      }
    );

    const dataSourceSortSubscription = this.dataSource
      .connect()
      .subscribe((sortedListItems) => {
        console.debug('sortedListItems', sortedListItems)
        this.sortedListItems = sortedListItems;
        this.setPageContextText();
      });

    this.subscriptions.push(
      addonInstalledSubscription,
      addonRemovedSubscription,
      displayAddonSubscription,
      dataSourceSortSubscription
    );
  }

  onStatusColumnUpdated() {
    this._cdRef.detectChanges();
  }

  public ngOnInit(): void {
    const selectedClientSubscription = this._sessionService.selectedClientType$
      .pipe(
        map((clientType) => {
          this.selectedClient = clientType;
          this.loadAddons(this.selectedClient);
        })
      )
      .subscribe();

    this.subscriptions.push(selectedClientSubscription);
  }

  public ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  public onRefresh() {
    this.spinnerMessage = this._translateService.instant(
      "PAGES.MY_ADDONS.SPINNER.LOADING"
    );
    this.loadAddons(this.selectedClient);
  }

  public onRowClicked(event: MouseEvent, row: AddonViewModel, index: number) {
    if (
      (event.ctrlKey && !this.electronService.isMac) ||
      (event.metaKey && this.electronService.isMac)
    ) {
      row.selected = !row.selected;
      return;
    }

    if (event.shiftKey) {
      const startIdx = this.sortedListItems.findIndex((item) => item.selected);
      this.sortedListItems.forEach((item, i) => {
        if (i >= startIdx && i <= index) {
          item.selected = true;
        } else {
          item.selected = false;
        }
      });
      return;
    }

    this.sortedListItems.forEach((item, i) => {
      if (item.addon.id === row.addon.id) {
        item.selected = !item.selected;
      } else {
        item.selected = false;
      }
    });
  }

  public selectAllRows(event: KeyboardEvent) {
    event.preventDefault();
    if (
      (event.ctrlKey && this.electronService.isMac) ||
      (event.metaKey && !this.electronService.isMac)
    ) {
      return;
    }

    this.sortedListItems.forEach((item) => {
      item.selected = true;
    });
  }

  public openDetailDialog(listItem: AddonViewModel) {
    const data: AddonDetailModel = {
      listItem: listItem.clone(),
    };

    const dialogRef = this._dialog.open(AddonDetailComponent, {
      data,
    });

    dialogRef.afterClosed().subscribe();
  }

  public filterAddons(): void {
    this.dataSource.filter = this.filter.trim().toLowerCase();
  }

  public onClearFilter(): void {
    this.filter = "";
    this.filterAddons();
  }

  public async onUpdateAll() {
    this.enableControls = false;

    try {
      const listItems = _.filter(
        this._displayAddonsSrc.value,
        (listItem) => listItem.needsInstall || listItem.needsUpdate
      );

      await Promise.all(
        listItems.map(async (listItem) => {
          try {
            this.addonService.installAddon(listItem.addon.id);
          } catch (e) {
            console.error("Failed to install", e);
          }
        })
      );
    } catch (err) {
      console.error(err);
    }

    this.enableControls = true;
  }

  public async onUpdateAllRetailClassic() {
    await this.updateAllWithSpinner(
      WowClientType.Retail,
      WowClientType.Classic
    );
  }

  public async onUpdateAllClients() {
    await this.updateAllWithSpinner(
      WowClientType.Retail,
      WowClientType.RetailPtr,
      WowClientType.Beta,
      WowClientType.ClassicPtr,
      WowClientType.Classic
    );
  }

  public onHeaderContext(event: MouseEvent) {
    event.preventDefault();
    this.updateContextMenuPosition(event);
    this.columnContextMenu.menuData = {
      columns: this.columns.filter((col) => col.allowToggle),
    };
    this.columnContextMenu.menu.focusFirstItem("mouse");
    this.columnContextMenu.openMenu();
  }

  public onCellContext(event: MouseEvent, listItem: AddonViewModel) {
    event.preventDefault();
    this.updateContextMenuPosition(event);

    const selectedItems = this._displayAddonsSrc.value.filter(
      (item) => item.selected
    );
    if (selectedItems.length > 1) {
      this.multiContextMenu.menuData = { listItems: selectedItems };
      this.multiContextMenu.menu.focusFirstItem("mouse");
      this.multiContextMenu.openMenu();
    } else {
      this.contextMenu.menuData = { listItem: listItem };
      this.contextMenu.menu.focusFirstItem("mouse");
      this.contextMenu.openMenu();
    }
  }

  public onUpdateAllContext(event: MouseEvent) {
    event.preventDefault();
    this.updateContextMenuPosition(event);
    this.updateAllContextMenu.openMenu();
  }

  public async onReInstallAddon(listItems: AddonViewModel) {
    await this.onReInstallAddons([listItems]);
  }

  public async onReInstallAddons(listItems: AddonViewModel[]) {
    for (let listItem of listItems) {
      try {
        await this.addonService.installAddon(listItem.addon.id);
      } catch (err) {
        console.error(err);
      }
    }
  }

  public onShowfolder(addon: Addon) {
    try {
      const addonPath = this.addonService.getFullInstallPath(addon);
      this.electronService.shell.openExternal(addonPath);
    } catch (err) {
      console.error(err);
    }
  }

  public onUpdateAddon(listItem: AddonViewModel) {
    listItem.isInstalling = true;

    this.addonService.installAddon(listItem.addon.id);
  }

  public onColumnVisibleChange(event: MatCheckboxChange, column: ColumnState) {
    const col = this.columns.find((col) => col.name === column.name);
    col.visible = event.checked;
  }

  public onReScan() {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant(
          "PAGES.MY_ADDONS.RESCAN_FOLDERS_CONFIRMATION_TITLE"
        ),
        message: this._translateService.instant(
          "PAGES.MY_ADDONS.RESCAN_FOLDERS_CONFIRMATION_DESCRIPTION"
        ),
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }
      this.loadAddons(this.selectedClient, true);
    });
  }

  public onClientChange() {
    this._sessionService.selectedClientType = this.selectedClient;
  }

  public onRemoveAddon(addon: Addon) {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant(
          "PAGES.MY_ADDONS.UNINSTALL_POPUP.TITLE",
          { count: 1 }
        ),
        message:
          this._translateService.instant(
            "PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ONE",
            { addonName: addon.name }
          ) +
          "\n" +
          this._translateService.instant(
            "PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ACTION_EXPLANATION"
          ),
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

  public onRemoveAddons(listItems: AddonViewModel[]) {
    let message = "";
    if (listItems.length > 3) {
      message = this._translateService.instant(
        "PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_MORE_THAN_THREE",
        { count: listItems.length }
      );
    } else {
      message = this._translateService.instant(
        "PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_LESS_THAN_THREE",
        { count: listItems.length }
      );
      listItems.forEach(
        (listItem) => (message = `${message}\n\t• ${listItem.addon.name}`)
      );
    }
    message +=
      "\n" +
      this._translateService.instant(
        "PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ACTION_EXPLANATION"
      );

    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant(
          "PAGES.MY_ADDONS.UNINSTALL_POPUP.TITLE",
          { count: listItems.length }
        ),
        message: message,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      console.log("The dialog was closed", result);
      if (!result) {
        return;
      }

      for (let listItem of listItems) {
        await this.addonService.removeAddon(listItem.addon);
      }
    });
  }

  public onInstall() {}

  public onClickIgnoreAddon(evt: MatCheckboxChange, listItem: AddonViewModel) {
    this.onClickIgnoreAddons(evt, [listItem]);
  }

  public onClickIgnoreAddons(
    evt: MatCheckboxChange,
    listItems: AddonViewModel[]
  ) {
    listItems.forEach((listItem) => {
      listItem.addon.isIgnored = evt.checked;
      if (evt.checked) {
        listItem.addon.autoUpdateEnabled = false;
      }
      this.addonService.saveAddon(listItem.addon);
    });

    if (!this.sort.active) {
      this.sortTable(this.dataSource);
    }
  }

  public onClickAutoUpdateAddon(
    evt: MatCheckboxChange,
    listItem: AddonViewModel
  ) {
    this.onClickAutoUpdateAddons(evt, [listItem]);
  }

  public onClickAutoUpdateAddons(
    evt: MatCheckboxChange,
    listItems: AddonViewModel[]
  ) {
    listItems.forEach((listItem) => {
      listItem.addon.autoUpdateEnabled = evt.checked;
      if (evt.checked) {
        listItem.addon.isIgnored = false;
      }
      this.addonService.saveAddon(listItem.addon);
    });

    if (!this.sort.active) {
      this.sortTable(this.dataSource);
    }
  }

  public onSelectedAddonChannelChange(
    evt: MatRadioChange,
    listItem: AddonViewModel
  ) {
    this.onSelectedAddonsChannelChange(evt, [listItem]);
  }

  public onSelectedAddonsChannelChange(
    evt: MatRadioChange,
    listItems: AddonViewModel[]
  ) {
    listItems.forEach((listItem) => {
      listItem.addon.channelType = evt.value;
      this.addonService.saveAddon(listItem.addon);
    });
    this.loadAddons(this.selectedClient);
  }

  public isSelectedItemsProp(listItems: AddonViewModel[], prop: string) {
    return _.some(listItems, prop);
  }

  private sortTable(dataSource: MatTableDataSource<AddonViewModel>) {
    this.dataSource.data = this.sortListItems(dataSource.data, dataSource.sort);
  }

  private async updateAllWithSpinner(...clientTypes: WowClientType[]) {
    this.isBusy = true;
    this.spinnerMessage = this._translateService.instant(
      "PAGES.MY_ADDONS.SPINNER.GATHERING_ADDONS"
    );

    try {
      let updatedCt = 0;
      let addons: Addon[] = [];
      for (let clientType of clientTypes) {
        addons = addons.concat(await this.addonService.getAddons(clientType));
      }

      // Only care about the ones that need to be updated/installed
      addons = addons
        .map((addon) => new AddonViewModel(addon))
        .filter((listItem) => listItem.needsUpdate || listItem.needsInstall)
        .map((listItem) => listItem.addon);

      if (addons.length === 0) {
        this.loadAddons(this.selectedClient);
        return;
      }

      this.spinnerMessage = this._translateService.instant(
        "PAGES.MY_ADDONS.SPINNER.UPDATING",
        {
          updateCount: updatedCt,
          addonCount: addons.length,
        }
      );

      for (let addon of addons) {
        updatedCt += 1;

        this.spinnerMessage = this._translateService.instant(
          "PAGES.MY_ADDONS.SPINNER.UPDATING_WITH_ADDON_NAME",
          {
            updateCount: updatedCt,
            addonCount: addons.length,
            clientType: getEnumName(WowClientType, addon.clientType),
            addonName: addon.name,
          }
        );

        await this.addonService.installAddon(addon.id);
      }

      this.loadAddons(this.selectedClient);
    } catch (err) {
      console.error("Failed to update classic/retail", err);
      this.isBusy = false;
    }
  }

  private updateContextMenuPosition(event: MouseEvent) {
    this.contextMenuPosition.x = event.clientX + "px";
    this.contextMenuPosition.y = event.clientY + "px";
  }

  private loadAddons(clientType: WowClientType, rescan = false) {
    this.isBusy = true;
    this.enableControls = false;
    this._cdRef.detectChanges();

    console.log("Load-addons", clientType);

    from(this.addonService.getAddons(clientType, rescan)).subscribe({
      next: (addons) => {
        this.isBusy = false;
        this.enableControls = true;
        this._displayAddonsSrc.next(this.formatAddons(addons));
        this.setPageContextText();
        this._cdRef.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.isBusy = false;
        this.enableControls = true;
      },
    });
  }

  private formatAddons(addons: Addon[]): AddonViewModel[] {
    const listItems = addons.map((addon) => this.createAddonListItem(addon));

    return this.sortListItems(listItems);
  }

  private sortListItems(listItems: AddonViewModel[], sort?: MatSort) {
    if (!sort || !sort.active || sort.direction === "") {
      return _.orderBy(listItems, ["sortOrder", "addon.name"]);
    }
    return _.orderBy(
      listItems,
      [(listItem) => _.get(listItem, sort.active, "")],
      [sort.direction === "asc" ? "asc" : "desc"]
    );
  }

  private filterListItem(item: AddonViewModel, filter: string) {
    if (
      stringIncludes(item.addon.name, filter) ||
      stringIncludes(item.addon.latestVersion, filter) ||
      stringIncludes(item.addon.author, filter)
    ) {
      return true;
    }
    return false;
  }

  private createAddonListItem(addon: Addon) {
    const listItem = new AddonViewModel(addon);

    if (!listItem.addon.installedVersion) {
      listItem.addon.installedVersion = "None";
    }

    return listItem;
  }

  private setPageContextText() {
    if (!this._displayAddonsSrc.value?.length) {
      return;
    }

    this._sessionService.setContextText(
      this.tabIndex,
      this._translateService.instant(
        "PAGES.MY_ADDONS.PAGE_CONTEXT_FOOTER.ADDONS_INSTALLED",
        { count: this._displayAddonsSrc.value.length }
      )
    );
  }

  private getInstallStateTextTranslationKey(installState: AddonInstallState) {
    switch (installState) {
      case AddonInstallState.BackingUp:
        return "COMMON.ADDON_STATUS.BACKINGUP";
      case AddonInstallState.Complete:
        return "COMMON.ADDON_STATE.UPTODATE";
      case AddonInstallState.Downloading:
        return "COMMON.ADDON_STATUS.DOWNLOADING";
      case AddonInstallState.Installing:
        return "COMMON.ADDON_STATUS.INSTALLING";
      case AddonInstallState.Pending:
        return "COMMON.ADDON_STATUS.PENDING";
      default:
        return "COMMON.ADDON_STATUS.UNKNOWN";
    }
  }
}
