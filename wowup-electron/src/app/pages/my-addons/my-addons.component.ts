import { Overlay, OverlayRef } from "@angular/cdk/overlay";
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import { MatCheckboxChange } from "@angular/material/checkbox";
import { MatDialog } from "@angular/material/dialog";
import { MatMenuTrigger } from "@angular/material/menu";
import { MatRadioChange } from "@angular/material/radio";
import { MatSort } from "@angular/material/sort";
import { MatTableDataSource } from "@angular/material/table";
import { TranslateService } from "@ngx-translate/core";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import * as _ from "lodash";
import { BehaviorSubject, from, Subscription } from "rxjs";
import { map } from "rxjs/operators";
import { AddonViewModel } from "../../business-objects/my-addon-list-item";
import { AddonDetailComponent, AddonDetailModel } from "../../components/addon-detail/addon-detail.component";
import { ConfirmDialogComponent } from "../../components/confirm-dialog/confirm-dialog.component";
import { Addon } from "../../entities/addon";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { ColumnState } from "../../models/wowup/column-state";
import { ElectronService } from "../../services";
import { AddonService } from "../../services/addons/addon.service";
import { SessionService } from "../../services/session/session.service";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { getEnumName } from "../../utils/enum.utils";
import { stringIncludes } from "../../utils/string.utils";
import { WowUpAddonService } from "../../services/wowup/wowup-addon.service";
import * as AddonUtils from "../../utils/addon.utils";
import { AlertDialogComponent } from "../../components/alert-dialog/alert-dialog.component";

@Component({
  selector: "app-my-addons",
  templateUrl: "./my-addons.component.html",
  styleUrls: ["./my-addons.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyAddonsComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input("tabIndex") tabIndex: number;

  @ViewChild("addonContextMenuTrigger", { static: false }) contextMenu: MatMenuTrigger;
  @ViewChild("addonMultiContextMenuTrigger", { static: false }) multiContextMenu: MatMenuTrigger;
  @ViewChild("columnContextMenuTrigger", { static: false }) columnContextMenu: MatMenuTrigger;
  @ViewChild("updateAllContextMenuTrigger", { static: false })
  updateAllContextMenu: MatMenuTrigger;
  @ViewChild(MatSort, { static: false }) sort: MatSort;
  @ViewChild("table", { static: false, read: ElementRef }) table: ElementRef;

  private readonly _displayAddonsSrc = new BehaviorSubject<AddonViewModel[]>([]);

  private subscriptions: Subscription[] = [];
  private isSelectedTab: boolean = false;
  private _lazyLoaded: boolean = false;
  private _automaticSort: boolean = false;

  public sortedListItems: AddonViewModel[] = [];
  public spinnerMessage = "";
  public contextMenuPosition = { x: "0px", y: "0px" };
  public dataSource = new MatTableDataSource<AddonViewModel>([]);
  public filter = "";
  public enableUpdateAll = false;
  public activeSort = "sortOrder";
  public activeSortDirection = "asc";
  public addonUtils = AddonUtils;
  public selectedClient = WowClientType.None;
  public wowClientType = WowClientType;
  public overlayRef: OverlayRef | null;
  public isBusy = true;
  public enableControls = true;

  public columns: ColumnState[] = [
    {
      name: "addon.name",
      display: "PAGES.MY_ADDONS.TABLE.ADDON_COLUMN_HEADER",
      visible: true,
    },
    {
      name: "sortOrder",
      display: "PAGES.MY_ADDONS.TABLE.STATUS_COLUMN_HEADER",
      visible: true,
    },
    {
      name: "installedAt",
      display: "PAGES.MY_ADDONS.TABLE.UPDATED_AT_COLUMN_HEADER",
      visible: true,
      allowToggle: true,
    },
    {
      name: "addon.latestVersion",
      display: "PAGES.MY_ADDONS.TABLE.LATEST_VERSION_COLUMN_HEADER",
      visible: true,
      allowToggle: true,
    },
    {
      name: "addon.releasedAt",
      display: "PAGES.MY_ADDONS.TABLE.RELEASED_AT_COLUMN_HEADER",
      visible: true,
      allowToggle: true,
    },
    {
      name: "addon.gameVersion",
      display: "PAGES.MY_ADDONS.TABLE.GAME_VERSION_COLUMN_HEADER",
      visible: true,
      allowToggle: true,
    },
    {
      name: "addon.externalChannel",
      display: "PAGES.MY_ADDONS.TABLE.PROVIDER_RELEASE_CHANNEL",
      visible: false,
      allowToggle: true,
    },
    {
      name: "addon.providerName",
      display: "PAGES.MY_ADDONS.TABLE.PROVIDER_COLUMN_HEADER",
      visible: true,
      allowToggle: true,
    },
    {
      name: "addon.author",
      display: "PAGES.MY_ADDONS.TABLE.AUTHOR_COLUMN_HEADER",
      visible: true,
      allowToggle: true,
    },
  ];

  public get displayedColumns(): string[] {
    return this.columns.filter((col) => col.visible).map((col) => col.name);
  }

  constructor(
    private addonService: AddonService,
    private _sessionService: SessionService,
    private _ngZone: NgZone,
    private _dialog: MatDialog,
    private _cdRef: ChangeDetectorRef,
    private _wowUpAddonService: WowUpAddonService,
    private _translateService: TranslateService,
    public electronService: ElectronService,
    public overlay: Overlay,
    public warcraftService: WarcraftService,
    public wowUpService: WowUpService
  ) {
    _sessionService.selectedHomeTab$.subscribe((tabIndex) => {
      this.isSelectedTab = tabIndex === this.tabIndex;
      if (!this.isSelectedTab) {
        return;
      }

      this.setPageContextText();
      this.lazyLoad();
    });

    const addonInstalledSubscription = this.addonService.addonInstalled$.subscribe(this.onAddonInstalledEvent);

    const addonRemovedSubscription = this.addonService.addonRemoved$.subscribe(this.onAddonRemoved);

    const displayAddonSubscription = this._displayAddonsSrc.subscribe(this.onDisplayAddonsChange);

    const dataSourceSortSubscription = this.dataSource.connect().subscribe(this.onDataSourceChange);

    this.subscriptions.push(
      addonInstalledSubscription,
      addonRemovedSubscription,
      displayAddonSubscription,
      dataSourceSortSubscription
    );
  }

  public ngOnInit(): void {
    const columnStates = this.wowUpService.myAddonsHiddenColumns;
    this.columns.forEach((col) => {
      if (!col.allowToggle) {
        return;
      }

      const state = _.find(columnStates, (cs) => cs.name === col.name);
      if (state) {
        col.visible = state.visible;
      }
    });
  }

  public ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  public ngAfterViewInit(): void {
    this._sessionService.autoUpdateComplete$.subscribe(() => {
      this._cdRef.markForCheck();
      this.onRefresh();
    });
  }

  public isLatestUpdateColumnVisible(): boolean {
    return this.columns.find((column) => column.name === "addon.latestVersion").visible;
  }

  public onSortChange(): void {
    if (this._automaticSort) {
      return;
    }

    if (this.table) {
      this.table.nativeElement.scrollIntoView({ behavior: "smooth" });
    }

    this.wowUpService.myAddonsSortOrder = {
      name: this.sort.active,
      direction: this.sort.direction,
    };
  }

  /**
   * This method should recall the stored column sort state
   * this method needs _automaticSort to prevent the sort from changing
   */
  private loadSortOrder = () => {
    const sortOrder = this.wowUpService.myAddonsSortOrder;
    if (sortOrder && this.sort) {
      this.activeSort = sortOrder.name;
      this.activeSortDirection = sortOrder.direction;
      this._automaticSort = true;
      this.sort.active = sortOrder.name;
      this.sort.direction = sortOrder.direction;
      this.sort.sortChange.emit();
      this._automaticSort = false;
    }
  };

  public onRefresh() {
    this.loadAddons(this.selectedClient);
  }

  public onRowClicked(event: MouseEvent, row: AddonViewModel, index: number) {
    if ((event.ctrlKey && !this.electronService.isMac) || (event.metaKey && this.electronService.isMac)) {
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
    if ((event.ctrlKey && this.electronService.isMac) || (event.metaKey && !this.electronService.isMac)) {
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
        (listItem) => !listItem.isIgnored && !listItem.isInstalling && (listItem.needsInstall || listItem.needsUpdate)
      );

      await Promise.all(
        listItems.map(async (listItem) => {
          try {
            this.addonService.updateAddon(listItem.addon.id);
          } catch (e) {
            console.error("Failed to install", e);
          }
        })
      );
    } catch (err) {
      console.error(err);
    }

    this.enableControls = this.calculateControlState();
  }

  public async onUpdateAllRetailClassic() {
    await this.updateAllWithSpinner(WowClientType.Retail, WowClientType.Classic);
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

    const selectedItems = this._displayAddonsSrc.value.filter((item) => item.selected);
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

  public onShowFolder(addon: Addon) {
    try {
      const addonPath = this.addonService.getFullInstallPath(addon);
      this.electronService.shell.openPath(addonPath);
    } catch (err) {
      console.error(err);
    }
  }

  public onColumnVisibleChange(event: MatCheckboxChange, column: ColumnState) {
    const col = this.columns.find((col) => col.name === column.name);
    col.visible = event.checked;
    this.wowUpService.myAddonsHiddenColumns = [...this.columns];
  }

  public onReScan() {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant("PAGES.MY_ADDONS.RESCAN_FOLDERS_CONFIRMATION_TITLE"),
        message: this._translateService.instant("PAGES.MY_ADDONS.RESCAN_FOLDERS_CONFIRMATION_DESCRIPTION"),
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
        title: this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.TITLE", { count: 1 }),
        message:
          this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ONE", {
            addonName: addon.name,
          }) +
          "\n\n" +
          this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ACTION_EXPLANATION"),
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }

      if (this.addonService.getRequiredDependencies(addon).length) {
        this.promptRemoveDependencies(addon);
      } else {
        this.addonService.removeAddon(addon);
      }
    });
  }

  private promptRemoveDependencies(addon: Addon) {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.DEPENDENCY_TITLE"),
        message:
          this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.DEPENDENCY_MESSAGE", {
            addonName: addon.name,
            dependencyCount: addon.dependencies.length,
          }) +
          "\n\n" +
          this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ACTION_EXPLANATION"),
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      this.addonService.removeAddon(addon, result);
    });
  }

  public onRemoveAddons(listItems: AddonViewModel[]) {
    let message = "";
    if (listItems.length > 3) {
      message = this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_MORE_THAN_THREE", {
        count: listItems.length,
      });
    } else {
      message = this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_LESS_THAN_THREE", {
        count: listItems.length,
      });
      listItems.forEach((listItem) => (message = `${message}\n\t• ${listItem.addon.name}`));
    }
    message +=
      "\n\n" + this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ACTION_EXPLANATION");

    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.TITLE", { count: listItems.length }),
        message: message,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
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

  public onClickIgnoreAddons(evt: MatCheckboxChange, listItems: AddonViewModel[]) {
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

  public onClickAutoUpdateAddon(evt: MatCheckboxChange, listItem: AddonViewModel) {
    this.onClickAutoUpdateAddons(evt, [listItem]);
  }

  public onClickAutoUpdateAddons(evt: MatCheckboxChange, listItems: AddonViewModel[]) {
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

  public onSelectedProviderChange(evt: MatRadioChange, listItem: AddonViewModel) {
    const messageData = {
      addonName: listItem.addon.name,
      providerName: evt.value,
    };

    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant("PAGES.MY_ADDONS.CHANGE_ADDON_PROVIDER_CONFIRMATION.TITLE"),
        message: this._translateService.instant(
          "PAGES.MY_ADDONS.CHANGE_ADDON_PROVIDER_CONFIRMATION.MESSAGE",
          messageData
        ),
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (!result) {
        return;
      }

      try {
        const externalId = _.find(listItem.addon.externalIds, (extid) => extid.providerName === evt.value);
        await this.addonService.setProvider(
          listItem.addon,
          externalId.id,
          externalId.providerName,
          this.selectedClient
        );
      } catch (e) {
        console.error(e);
        const errorTitle = this._translateService.instant("DIALOGS.ALERT.ERROR_TITLE");
        const errorMessage = this._translateService.instant("COMMON.ERRORS.CHANGE_PROVIDER_ERROR", messageData);
        this.showErrorMessage(errorTitle, errorMessage);
      }
    });
  }

  public onSelectedAddonChannelChange(evt: MatRadioChange, listItem: AddonViewModel) {
    this.onSelectedAddonsChannelChange(evt, [listItem]);
  }

  public onSelectedAddonsChannelChange(evt: MatRadioChange, listItems: AddonViewModel[]) {
    listItems.forEach((listItem) => {
      listItem.addon.channelType = evt.value;
      this.addonService.saveAddon(listItem.addon);
    });
    this.loadAddons(this.selectedClient);
  }

  public isIndeterminate(listItems: AddonViewModel[], prop: string) {
    return _.some(listItems, prop) && !this.isAllItemsSelected(listItems, prop);
  }

  public isAllItemsSelected(listItems: AddonViewModel[], prop: string) {
    return _.filter(listItems, prop).length === listItems.length;
  }

  public getChannelTypeLocaleKey(channelType: string) {
    return `COMMON.ENUM.ADDON_CHANNEL_TYPE.${channelType?.toUpperCase()}`;
  }

  private async lazyLoad() {
    if (this._lazyLoaded) {
      return;
    }

    this._lazyLoaded = true;
    this.isBusy = true;
    this.enableControls = false;

    console.debug("LAZY LOAD");

    await this.addonService.backfillAddons();

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

  private sortTable(dataSource: MatTableDataSource<AddonViewModel>) {
    this.dataSource.data = this.sortListItems(dataSource.data, dataSource.sort);
  }

  private async updateAllWithSpinner(...clientTypes: WowClientType[]) {
    this.isBusy = true;
    this.spinnerMessage = this._translateService.instant("PAGES.MY_ADDONS.SPINNER.GATHERING_ADDONS");

    try {
      let updatedCt = 0;
      let addons: Addon[] = [];
      for (let clientType of clientTypes) {
        addons = addons.concat(await this.addonService.getAddons(clientType));
      }

      // Only care about the ones that need to be updated/installed
      addons = addons.filter(
        (addon) => !addon.isIgnored && (AddonUtils.needsUpdate(addon) || AddonUtils.needsInstall(addon))
      );

      if (addons.length === 0) {
        this.loadAddons(this.selectedClient);
        return;
      }

      this.spinnerMessage = this._translateService.instant("PAGES.MY_ADDONS.SPINNER.UPDATING", {
        updateCount: updatedCt,
        addonCount: addons.length,
      });

      for (let addon of addons) {
        updatedCt += 1;

        this.spinnerMessage = this._translateService.instant("PAGES.MY_ADDONS.SPINNER.UPDATING_WITH_ADDON_NAME", {
          updateCount: updatedCt,
          addonCount: addons.length,
          clientType: getEnumName(WowClientType, addon.clientType),
          addonName: addon.name,
        });

        await this.addonService.updateAddon(addon.id);
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

  private async loadAddons(clientType: WowClientType, rescan = false) {
    this.isBusy = true;
    this.enableControls = false;
    this._cdRef.detectChanges();

    console.log("Load-addons", clientType);

    try {
      const addons = await this.addonService.getAddons(clientType, rescan);
      this.isBusy = false;
      this.enableControls = this.calculateControlState();
      this._displayAddonsSrc.next(this.formatAddons(addons));
      this.setPageContextText();
      this._cdRef.detectChanges();
      this._wowUpAddonService.persistUpdateInformationToWowUpAddon(addons);
    } catch (e) {
      console.error(e);
      this.isBusy = false;
      this.enableControls = this.calculateControlState();
    } finally {
      this._cdRef.detectChanges();
    }
  }

  private formatAddons(addons: Addon[]): AddonViewModel[] {
    const listItems = addons.map((addon) => this.createAddonListItem(addon));

    return this.sortListItems(listItems);
  }

  private sortListItems(listItems: AddonViewModel[], sort?: MatSort) {
    if (!sort || !sort.active || sort.direction === "") {
      return _.orderBy(
        listItems,
        ["sortOrder", "addon.name"].map((column) => {
          return (row) => {
            let value = _.get(row, column);
            return typeof value === "string" ? value.toLowerCase() : value;
          };
        })
      );
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
      this._translateService.instant("PAGES.MY_ADDONS.PAGE_CONTEXT_FOOTER.ADDONS_INSTALLED", {
        count: this._displayAddonsSrc.value.length,
      })
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

  private onAddonInstalledEvent = (evt: AddonUpdateEvent) => {
    let listItems: AddonViewModel[] = [].concat(this._displayAddonsSrc.value);
    const listItemIdx = listItems.findIndex((li) => li.addon.id === evt.addon.id);
    const listItem = this.createAddonListItem(evt.addon);
    listItem.isInstalling = [
      AddonInstallState.Installing,
      AddonInstallState.Downloading,
      AddonInstallState.BackingUp,
    ].includes(evt.installState);
    listItem.stateTextTranslationKey = this.getInstallStateTextTranslationKey(evt.installState);
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
  };

  private onAddonRemoved = (addonId: string) => {
    const addons: AddonViewModel[] = [].concat(this._displayAddonsSrc.value);
    const listItemIdx = addons.findIndex((li) => li.addon.id === addonId);
    addons.splice(listItemIdx, 1);

    this._ngZone.run(() => {
      this._displayAddonsSrc.next(addons);
    });
  };

  private onDisplayAddonsChange = (items: AddonViewModel[]) => {
    this.dataSource.data = items;
    this.dataSource.sortingDataAccessor = (data: any, sortHeaderId: string) => {
      let value = _.get(data, sortHeaderId);
      return typeof value === "string" ? value.toLowerCase() : value;
    };

    this.dataSource.filterPredicate = this.filterListItem;
    this.dataSource.sort = this.sort;
    this.loadSortOrder();
  };

  private onDataSourceChange = (sortedListItems: AddonViewModel[]) => {
    this.sortedListItems = sortedListItems;
    this.enableUpdateAll = this.sortedListItems.some(
      (li) => !li.isIgnored && !li.isInstalling && (li.needsInstall || li.needsUpdate)
    );
    this.enableControls = this.calculateControlState();
    this.setPageContextText();
  };

  private showErrorMessage(title: string, message: string) {
    const dialogRef = this._dialog.open(AlertDialogComponent, {
      minWidth: 250,
      data: {
        title,
        message,
      },
    });
    dialogRef.afterClosed().subscribe();
  }

  private calculateControlState(): boolean {
    if (!this._displayAddonsSrc.value) {
      return true;
    }

    return !this._displayAddonsSrc.value.some((item) => item.isInstalling);
  }
}
