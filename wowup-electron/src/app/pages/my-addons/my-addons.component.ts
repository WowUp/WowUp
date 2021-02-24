import * as _ from "lodash";
import { join } from "path";
import { BehaviorSubject, from, Observable, of, Subject, Subscription, zip } from "rxjs";
import { catchError, debounceTime, first, map, switchMap, tap } from "rxjs/operators";

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
import { MatSort, Sort } from "@angular/material/sort";
import { MatTableDataSource } from "@angular/material/table";
import { TranslateService } from "@ngx-translate/core";

import { AddonViewModel } from "../../business-objects/addon-view-model";
import { AddonDetailComponent, AddonDetailModel } from "../../components/addon-detail/addon-detail.component";
import { AlertDialogComponent } from "../../components/alert-dialog/alert-dialog.component";
import { ConfirmDialogComponent } from "../../components/confirm-dialog/confirm-dialog.component";
import { Addon } from "../../../common/entities/addon";
import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { ColumnState } from "../../models/wowup/column-state";
import { ElectronService } from "../../services";
import { AddonService } from "../../services/addons/addon.service";
import { SessionService } from "../../services/session/session.service";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { SnackbarService } from "../../services/snackbar/snackbar.service";
import { WowUpAddonService } from "../../services/wowup/wowup-addon.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import * as AddonUtils from "../../utils/addon.utils";
import { getEnumName } from "../../utils/enum.utils";
import { stringIncludes } from "../../utils/string.utils";
import { WowInstallation } from "app/models/wowup/wow-installation";
import { WarcraftInstallationService } from "app/services/warcraft/warcraft-installation.service";

class ListItemDataSource extends MatTableDataSource<AddonViewModel> {
  constructor(private subject: BehaviorSubject<AddonViewModel[]>) {
    super();

    subject.subscribe((data) => {
      this.data = data;
    });
  }

  _filterData = (data: AddonViewModel[]): AddonViewModel[] => {
    const canonicalFilter = this.filter.trim().toLowerCase();
    const filterData = this.subject?.value ?? [];
    const results = _.filter(filterData, (model) => {
      return model.addon.name.toLowerCase().indexOf(canonicalFilter) !== -1;
    });
    return results;
  };
}

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

  // private readonly _displayAddonsSrc = new BehaviorSubject<AddonViewModel[]>([]);
  private readonly _operationErrorSrc = new Subject<Error>();

  private subscriptions: Subscription[] = [];
  private isSelectedTab = false;
  private _lazyLoaded = false;
  private _dataSubject = new BehaviorSubject<AddonViewModel[]>([]);
  private _isRefreshing = false;

  public readonly operationError$ = this._operationErrorSrc.asObservable();

  public sortedListItems: AddonViewModel[] = [];
  public spinnerMessage = "";
  public contextMenuPosition = { x: "0px", y: "0px" };
  public dataSource: ListItemDataSource;
  public filter = "";
  public enableUpdateAll = false;
  public activeSort = "sortOrder";
  public activeSortDirection = "asc";
  public addonUtils = AddonUtils;
  public selectedClient = WowClientType.None;
  public selectedInstallation: WowInstallation = undefined;
  public wowClientType = WowClientType;
  public overlayRef: OverlayRef | null;
  public isBusy = true;
  public enableControls = true;
  public data$ = this._dataSubject.asObservable();
  public wowInstallations$: Observable<WowInstallation[]>;
  public selectedInstallationId: string;

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
      name: "releasedAt",
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
    private _sessionService: SessionService,
    private _ngZone: NgZone,
    private _dialog: MatDialog,
    private _cdRef: ChangeDetectorRef,
    private _wowUpAddonService: WowUpAddonService,
    private _translateService: TranslateService,
    private _snackbarService: SnackbarService,
    public addonService: AddonService,
    public electronService: ElectronService,
    public overlay: Overlay,
    public warcraftService: WarcraftService,
    public wowUpService: WowUpService,
    public warcraftInstallationService: WarcraftInstallationService
  ) {
    this.wowInstallations$ = warcraftInstallationService.wowInstallations$;

    this.wowInstallations$.subscribe((i) => {
      console.debug("WOW INSTALLS CH", i);
    });

    this.dataSource = new ListItemDataSource(this._dataSubject);

    const sortOrder = this.wowUpService.myAddonsSortOrder;
    this.activeSort = sortOrder?.name ?? "";
    this.activeSortDirection = sortOrder?.direction ?? "";

    this.subscriptions.push(
      this._sessionService.selectedHomeTab$.subscribe(this.onSelectedTabChange),
      this._sessionService.addonsChanged$.subscribe(() => this.onRefresh()),
      this.addonService.addonInstalled$.subscribe(this.onAddonInstalledEvent),
      this.addonService.addonRemoved$.subscribe(this.onAddonRemoved),
      // this._displayAddonsSrc.subscribe(this.onDisplayAddonsChange),
      this.dataSource.connect().subscribe(this.onDataSourceChange)
    );
  }

  public ngOnInit(): void {
    this.subscriptions.push(
      this.operationError$.subscribe({
        next: () => {
          this._snackbarService.showErrorSnackbar("PAGES.MY_ADDONS.ERROR_SNACKBAR");
        },
      })
    );

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

    this.onSelectedTabChange(this._sessionService.getSelectedHomeTab());
  }

  public ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  public ngAfterViewInit(): void {
    this._sessionService.autoUpdateComplete$.subscribe(() => {
      console.log("Checking for addon updates...");
      this._cdRef.markForCheck();
      this.loadAddons(this.selectedInstallation).subscribe();
    });
  }

  public onSelectedTabChange = (tabIndex: number): void => {
    this.isSelectedTab = tabIndex === this.tabIndex;
    if (!this.isSelectedTab) {
      return;
    }

    this.setPageContextText();
    this.lazyLoad().catch((e) => console.error(e));
  };

  // Get the translated value of the provider name (unknown)
  // If the key is returned there's nothing to translate return the normal name
  public getProviderName(viewModel: AddonViewModel): Observable<string> {
    const key = `APP.PROVIDERS.${viewModel.addon.providerName.toUpperCase()}`;
    return this._translateService.get(key).pipe(map((tx) => (tx === key ? viewModel.addon.providerName : tx)));
  }

  public isLatestUpdateColumnVisible(): boolean {
    return this.columns.find((column) => column.name === "addon.latestVersion").visible;
  }

  public onSortChange(sort: Sort): void {
    const sortedData = this.sortAddons(this._dataSubject.value.slice(), sort);
    this.wowUpService.myAddonsSortOrder = {
      name: this.sort.active,
      direction: this.sort.direction,
    };

    this.activeSort = this.sort.active;
    this.activeSortDirection = this.sort.direction;

    this._dataSubject.next(sortedData);
  }

  public onRefresh(): void {
    if (this._isRefreshing) {
      return;
    }

    this._isRefreshing = true;
    this.isBusy = true;
    this.enableControls = false;
    from(this.addonService.syncInstallationAddons(this.selectedInstallation))
      .pipe(
        tap(() => console.debug("onRefresh")),
        switchMap(() => this.loadAddons(this.selectedInstallation)),
        switchMap(() => from(this._wowUpAddonService.updateForInstallation(this.selectedInstallation))),
        tap(() => {
          this.isBusy = false;
          this.enableControls = true;
          this._isRefreshing = false;
        })
      )
      .subscribe();
  }

  public unselectAll(): void {
    this.sortedListItems.forEach((item) => {
      item.selected = false;
    });
  }

  public onRowClicked(event: MouseEvent, row: AddonViewModel, index: number): void {
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

    this.sortedListItems.forEach((item) => {
      if (item.addon.id === row.addon.id) {
        item.selected = !item.selected;
      } else {
        item.selected = false;
      }
    });
  }

  public selectAllRows(event: KeyboardEvent): void {
    event.preventDefault();
    if ((event.ctrlKey && this.electronService.isMac) || (event.metaKey && !this.electronService.isMac)) {
      return;
    }

    this.sortedListItems.forEach((item) => {
      item.selected = true;
    });
  }

  public canSetAutoUpdate(listItem: AddonViewModel): boolean {
    return listItem.addon.isIgnored === false && listItem.addon.warningType === undefined;
  }

  public canReInstall(listItem: AddonViewModel): boolean {
    return listItem.addon.warningType === undefined && this.addonService.canReinstall(listItem.addon);
  }

  public openDetailDialog(listItem: AddonViewModel): void {
    // If this addon is in warning state, we wont be able to get details
    if (listItem.addon.warningType !== undefined) {
      return;
    }

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

  // TODO change this to rely on addon service now view models
  public async onUpdateAll(): Promise<void> {
    this.enableControls = false;

    try {
      const listItems = _.filter(
        this._dataSubject.value,
        (listItem) =>
          !listItem.addon.isIgnored && !listItem.isInstalling && (listItem.needsInstall() || listItem.needsUpdate())
      );

      const promises = listItems.map(async (listItem) => {
        try {
          await this.addonService.updateAddon(listItem.addon.id);
        } catch (e) {
          console.error("Failed to install", e);
        }
      });

      await Promise.all(promises);
    } catch (err) {
      console.error(err);
    }

    this.enableControls = this.calculateControlState();
  }

  public onUpdateAllRetailClassic(): void {
    const installations = this.warcraftInstallationService
      .getWowInstallations()
      .filter(
        (installation) =>
          installation.clientType === WowClientType.Retail || installation.clientType === WowClientType.Classic
      );
    this.updateAllWithSpinner(...installations).catch((e) => console.error(e));
  }

  public onUpdateAllClients(): void {
    this.updateAllWithSpinner(...this.warcraftInstallationService.getWowInstallations()).catch((e) => console.error(e));
  }

  public onHeaderContext(event: MouseEvent): void {
    event.preventDefault();
    this.updateContextMenuPosition(event);
    this.columnContextMenu.menuData = {
      columns: this.columns.filter((col) => col.allowToggle),
    };
    this.columnContextMenu.menu.focusFirstItem("mouse");
    this.columnContextMenu.openMenu();
  }

  public onCellContext(event: MouseEvent, listItem: AddonViewModel): void {
    event.preventDefault();
    this.updateContextMenuPosition(event);

    const selectedItems = this._dataSubject.value.filter((item) => item.selected);
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

  public closeContextMenu(): void {
    this.contextMenu.closeMenu();
  }

  public onUpdateAllContext(event: MouseEvent): void {
    event.preventDefault();
    this.updateContextMenuPosition(event);
    this.updateAllContextMenu.openMenu();
  }

  public onReInstallAddon(listItems: AddonViewModel): void {
    this.onReInstallAddons([listItems]).catch((e) => console.error(e));
  }

  public async onReInstallAddons(listItems: AddonViewModel[]): Promise<void> {
    for (const listItem of listItems) {
      try {
        await this.addonService.installAddon(listItem.addon.id);
      } catch (err) {
        console.error(err);
      }
    }
  }

  public async onShowFolder(addon: Addon, folder: string): Promise<void> {
    try {
      const addonPath = this.addonService.getInstallBasePath(addon);
      const folderPath = join(addonPath, folder);
      await this.electronService.openPath(folderPath);
    } catch (err) {
      console.error(err);
    }
  }

  public onColumnVisibleChange(event: MatCheckboxChange, column: ColumnState): void {
    const col = this.columns.find((col) => col.name === column.name);
    col.visible = event.checked;
    this.wowUpService.myAddonsHiddenColumns = [...this.columns];
  }

  public onReScan(): void {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant("PAGES.MY_ADDONS.RESCAN_FOLDERS_CONFIRMATION_TITLE"),
        message: this._translateService.instant("PAGES.MY_ADDONS.RESCAN_FOLDERS_CONFIRMATION_DESCRIPTION"),
      },
    });

    dialogRef
      .afterClosed()
      .pipe(
        switchMap((result) => {
          return result ? from(this.loadAddons(this.selectedInstallation, true)) : of(undefined);
        })
      )
      .subscribe();
  }

  public onClientChange(): void {
    this._sessionService.setSelectedWowInstallation(this.selectedInstallationId);
  }

  public onRemoveAddon(addon: Addon): void {
    const title = this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.TITLE", { count: 1 });
    const message1: string = this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ONE", {
      addonName: addon.name,
    });
    const message2: string = this._translateService.instant(
      "PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ACTION_EXPLANATION"
    );

    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title,
        message: `${message1}\n\n${message2}`,
      },
    });

    dialogRef
      .afterClosed()
      .pipe(
        switchMap((result) => {
          if (!result) {
            return of(undefined);
          }

          return this.addonService.getRequiredDependencies(addon).length
            ? of(this.promptRemoveDependencies(addon))
            : from(this.addonService.removeAddon(addon));
        })
      )
      .subscribe();
  }

  private promptRemoveDependencies(addon: Addon): void {
    const title = this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.DEPENDENCY_TITLE");
    const message1: string = this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.DEPENDENCY_MESSAGE", {
      addonName: addon.name,
      dependencyCount: addon.dependencies.length,
    });
    const message2: string = this._translateService.instant(
      "PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ACTION_EXPLANATION"
    );

    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title,
        message: `${message1}\n\n${message2}`,
      },
    });

    dialogRef
      .afterClosed()
      .pipe(switchMap((result) => from(this.addonService.removeAddon(addon, result))))
      .subscribe();
  }

  public onRemoveAddons(listItems: AddonViewModel[]): void {
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
      "\n\n" +
      (this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ACTION_EXPLANATION") as string);

    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.TITLE", { count: listItems.length }),
        message: message,
      },
    });

    dialogRef
      .afterClosed()
      .pipe(
        switchMap((result) => {
          if (!result) {
            return of(undefined);
          }

          return zip(listItems.map((listItem) => from(this.addonService.removeAddon(listItem.addon))));
        })
      )
      .subscribe();
  }

  public onClickIgnoreAddon(listItem: AddonViewModel): void {
    this.onClickIgnoreAddons([listItem]);
  }

  public onClickIgnoreAddons(listItems: AddonViewModel[]): void {
    const isIgnored = _.every(listItems, (listItem) => listItem.addon.isIgnored === false);
    listItems.forEach((listItem) => {
      // if provider is not valid (Unknown) then ignore this
      if (!this.addonService.isValidProviderName(listItem.addon.providerName)) {
        return;
      }

      listItem.addon.isIgnored = isIgnored;
      if (isIgnored) {
        listItem.addon.autoUpdateEnabled = false;
      }
      this.addonService.saveAddon(listItem.addon);
    });
  }

  public onClickAutoUpdateAddon(listItem: AddonViewModel): void {
    this.onClickAutoUpdateAddons([listItem]);
  }

  public onClickAutoUpdateAddons(listItems: AddonViewModel[]): void {
    const isAutoUpdate = _.every(listItems, (listItem) => listItem.addon.autoUpdateEnabled === false);
    try {
      listItems.forEach((listItem) => {
        listItem.addon.autoUpdateEnabled = isAutoUpdate;
        if (isAutoUpdate) {
          listItem.addon.isIgnored = false;
        }
        this.addonService.saveAddon(listItem.addon);
      });

      if (isAutoUpdate) {
        this.addonService.processAutoUpdates().catch((e) => console.error(e));
      }
    } catch (e) {
      console.error(e);
      this._operationErrorSrc.next(e);
    }
  }

  public onSelectedProviderChange(evt: MatRadioChange, listItem: AddonViewModel): void {
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

    dialogRef
      .afterClosed()
      .pipe(
        switchMap((result) => {
          if (!result) {
            return of(undefined);
          }

          const externalId = _.find(listItem.addon.externalIds, (extId) => extId.providerName === evt.value);
          return from(
            this.addonService.setProvider(
              listItem.addon,
              externalId.id,
              externalId.providerName,
              this.selectedInstallation
            )
          );
        }),
        catchError((e) => {
          console.error(e);
          const errorTitle = this._translateService.instant("DIALOGS.ALERT.ERROR_TITLE");
          const errorMessage = this._translateService.instant("COMMON.ERRORS.CHANGE_PROVIDER_ERROR", messageData);
          this.showErrorMessage(errorTitle, errorMessage);
          return of(undefined);
        })
      )
      .subscribe();
  }

  public onSelectedAddonChannelChange(evt: MatRadioChange, listItem: AddonViewModel): void {
    this.onSelectedAddonsChannelChange(evt, [listItem]);
  }

  public onSelectedAddonsChannelChange(evt: MatRadioChange, listItems: AddonViewModel[]): void {
    listItems.forEach((listItem) => {
      listItem.addon.channelType = evt.value;
      this.addonService.saveAddon(listItem.addon);
    });

    console.debug("onSelectedAddonsChannelChange");
    this.loadAddons(this.selectedInstallation).subscribe();
  }

  public isIndeterminate(listItems: AddonViewModel[], prop: string): boolean {
    return _.some(listItems, prop) && !this.isAllItemsSelected(listItems, prop);
  }

  public isAllItemsSelected(listItems: AddonViewModel[], prop: string): boolean {
    return _.filter(listItems, prop).length === listItems.length;
  }

  public getChannelTypeLocaleKey(channelType: string): string {
    return channelType ? `COMMON.ENUM.ADDON_CHANNEL_TYPE.${channelType.toUpperCase()}` : "COMMON.ADDON_STATUS.ERROR";
  }

  public onTableBlur(evt: MouseEvent): void {
    evt.stopPropagation();

    const ePath = (evt as any).path as HTMLElement[];
    const tableElem = ePath.find((tag) => tag.tagName === "TABLE");
    if (tableElem) {
      return;
    }

    this.unselectAll();
  }

  private async lazyLoad(): Promise<void> {
    if (this._lazyLoaded) {
      return;
    }

    console.debug("LAZY LOAD");

    this._lazyLoaded = true;
    this.isBusy = true;
    this.enableControls = false;

    await this.addonService.backfillAddons();

    const selectedInstallationSub = this._sessionService.selectedWowInstallation$
      .pipe(
        debounceTime(300),
        switchMap((installation) => {
          this.selectedInstallation = installation;
          this.selectedInstallationId = installation.id;
          return this.loadAddons(this.selectedInstallation);
        })
      )
      .subscribe();

    // const selectedClientSubscription = this._sessionService.selectedClientType$
    //   .pipe(
    //     switchMap((clientType) => {
    //       this.selectedClient = clientType;
    //       return this.loadAddons(this.selectedClient);
    //     })
    //   )
    //   .subscribe();

    this.subscriptions.push(selectedInstallationSub);
  }

  private async updateAllWithSpinner(...installations: WowInstallation[]): Promise<void> {
    this.isBusy = true;
    this.spinnerMessage = this._translateService.instant("PAGES.MY_ADDONS.SPINNER.GATHERING_ADDONS");

    let addons: Addon[] = [];
    let updatedCt = 0;

    try {
      for (const installation of installations) {
        addons = addons.concat(await this.addonService.getAddons(installation));
      }

      // Only care about the ones that need to be updated/installed
      addons = addons.filter(
        (addon) => !addon.isIgnored && (AddonUtils.needsUpdate(addon) || AddonUtils.needsInstall(addon))
      );

      if (addons.length === 0) {
        await this.loadAddons(this.selectedInstallation).toPromise();
        return;
      }

      this.spinnerMessage = this._translateService.instant("PAGES.MY_ADDONS.SPINNER.UPDATING", {
        updateCount: updatedCt,
        addonCount: addons.length,
      });

      for (const addon of addons) {
        updatedCt += 1;

        this.spinnerMessage = this._translateService.instant("PAGES.MY_ADDONS.SPINNER.UPDATING_WITH_ADDON_NAME", {
          updateCount: updatedCt,
          addonCount: addons.length,
          clientType: getEnumName(WowClientType, addon.clientType),
          addonName: addon.name,
        });

        await this.addonService.updateAddon(addon.id);
      }

      await this.loadAddons(this.selectedInstallation).toPromise();
    } catch (err) {
      console.error("Failed to update classic/retail", err);
      this.isBusy = false;
      this._cdRef.detectChanges();
    }
  }

  private notifyAndUpdate(index: number, addonCt: number, addon: Addon): Observable<void> {
    this.spinnerMessage = this._translateService.instant("PAGES.MY_ADDONS.SPINNER.UPDATING_WITH_ADDON_NAME", {
      updateCount: index,
      addonCount: addonCt,
      clientType: getEnumName(WowClientType, addon.clientType),
      addonName: addon.name,
    });

    return from(this.addonService.updateAddon(addon.id));
  }

  private updateContextMenuPosition(event: MouseEvent): void {
    this.contextMenuPosition.x = `${event.clientX}px`;
    this.contextMenuPosition.y = `${event.clientY}px`;
  }

  private sortAddons(addons: AddonViewModel[], sort?: Sort) {
    const direction = (sort?.direction as "asc" | "desc") ?? (this.activeSortDirection as "asc" | "desc");
    const active = sort?.active ?? this.activeSort;

    if (active === "sortOrder") {
      return _.orderBy(addons, [active, "addon.name"], [direction, "asc"]);
    }

    return _.orderBy(addons, [active], [direction]);
  }

  private loadAddons(installation: WowInstallation, rescan = false): Observable<void> {
    this.isBusy = true;
    this.enableControls = false;
    this._cdRef.detectChanges();

    if (!installation) {
      return of(undefined);
    }

    console.debug("LOAD ADDONS");
    return from(this.addonService.getAddons(installation, rescan)).pipe(
      map((addons) => {
        const rowData = this.formatAddons(addons);
        this.enableControls = this.calculateControlState();

        this._dataSubject.next(this.sortAddons(rowData));
        this.isBusy = false;
        // this._displayAddonsSrc.next(rowData);
        this.setPageContextText();
        this._cdRef.detectChanges();
      }),
      catchError((e) => {
        console.error(e);
        this.isBusy = false;
        this.enableControls = this.calculateControlState();
        return of(undefined);
      }),
      tap(() => {
        this._cdRef.detectChanges();
      })
    );
  }

  private formatAddons(addons: Addon[]): AddonViewModel[] {
    return addons.map((addon) => this.createAddonListItem(addon));
  }

  private filterListItem = (item: AddonViewModel, filter: string) => {
    if (
      stringIncludes(item.addon.name, filter) ||
      stringIncludes(item.addon.latestVersion, filter) ||
      stringIncludes(item.addon.author, filter)
    ) {
      return true;
    }
    return false;
  };

  private createAddonListItem(addon: Addon) {
    const listItem = new AddonViewModel(addon);

    if (!listItem.addon.installedVersion) {
      listItem.addon.installedVersion = "";
    }

    return listItem;
  }

  private setPageContextText() {
    const itemsLength = this._dataSubject.value.length;
    if (itemsLength === 0) {
      return;
    }

    this._sessionService.setContextText(
      this.tabIndex,
      this._translateService.instant("PAGES.MY_ADDONS.PAGE_CONTEXT_FOOTER.ADDONS_INSTALLED", {
        count: itemsLength,
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
    let listItems: AddonViewModel[] = this._dataSubject.value.slice();
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
      listItems = this.sortAddons(listItems);
    }

    this._dataSubject.next(listItems);
  };

  private onAddonRemoved = (addonId: string) => {
    const addons: AddonViewModel[] = this._dataSubject.value.slice();
    const listItemIdx = addons.findIndex((li) => li.addon.id === addonId);
    addons.splice(listItemIdx, 1);

    this._dataSubject.next(addons);
  };

  private onDataSourceChange = (sortedListItems: AddonViewModel[]) => {
    this.sortedListItems = sortedListItems;
    this.enableUpdateAll = this.sortedListItems.some(
      (li) => !li.addon.isIgnored && !li.isInstalling && (li.needsInstall() || li.needsUpdate())
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
    if (!this._dataSubject.value) {
      return true;
    }

    return !this._dataSubject.value.some((item) => item.isInstalling);
  }
}
