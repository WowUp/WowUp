import {
  CellContextMenuEvent,
  ColDef,
  ColumnApi,
  GridApi,
  GridReadyEvent,
  RowClassParams,
  RowClickedEvent,
  RowDoubleClickedEvent,
  RowNode,
  SortChangedEvent,
} from "ag-grid-community";
import * as _ from "lodash";
import { join } from "path";
import { from, Observable, of, Subject, Subscription, zip } from "rxjs";
import { catchError, debounceTime, first, map, switchMap, tap } from "rxjs/operators";

import { Overlay, OverlayRef } from "@angular/cdk/overlay";
import { AfterViewInit, ChangeDetectorRef, Component, Input, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { MatCheckboxChange } from "@angular/material/checkbox";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { MatMenuTrigger } from "@angular/material/menu";
import { MatRadioChange } from "@angular/material/radio";
import { TranslateService } from "@ngx-translate/core";

import { Addon } from "../../../common/entities/addon";
import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { AddonViewModel } from "../../business-objects/addon-view-model";
import { CellWrapTextComponent } from "../../components/cell-wrap-text/cell-wrap-text.component";
import { ConfirmDialogComponent } from "../../components/confirm-dialog/confirm-dialog.component";
import { DateTooltipCellComponent } from "../../components/date-tooltip-cell/date-tooltip-cell.component";
import { MyAddonStatusColumnComponent } from "../../components/my-addon-status-column/my-addon-status-column.component";
import { MyAddonsAddonCellComponent } from "../../components/my-addons-addon-cell/my-addons-addon-cell.component";
import { TableContextHeaderCellComponent } from "../../components/table-context-header-cell/table-context-header-cell.component";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { ColumnState } from "../../models/wowup/column-state";
import { WowInstallation } from "../../models/wowup/wow-installation";
import { RelativeDurationPipe } from "../../pipes/relative-duration-pipe";
import { ElectronService } from "../../services";
import { AddonService } from "../../services/addons/addon.service";
import { DialogFactory } from "../../services/dialog/dialog.factory";
import { SessionService } from "../../services/session/session.service";
import { SnackbarService } from "../../services/snackbar/snackbar.service";
import { WarcraftInstallationService } from "../../services/warcraft/warcraft-installation.service";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { WowUpAddonService } from "../../services/wowup/wowup-addon.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import * as AddonUtils from "../../utils/addon.utils";
import { getEnumName } from "../../utils/enum.utils";
import { stringIncludes } from "../../utils/string.utils";

@Component({
  selector: "app-my-addons",
  templateUrl: "./my-addons.component.html",
  styleUrls: ["./my-addons.component.scss"],
})
export class MyAddonsComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input("tabIndex") public tabIndex: number;

  @ViewChild("addonContextMenuTrigger", { static: false }) public contextMenu: MatMenuTrigger;
  @ViewChild("addonMultiContextMenuTrigger", { static: false }) public multiContextMenu: MatMenuTrigger;
  @ViewChild("columnContextMenuTrigger", { static: false }) public columnContextMenu: MatMenuTrigger;
  @ViewChild("updateAllContextMenuTrigger", { static: false })

  // @HostListener("window:keydown", ["$event"])
  private readonly _operationErrorSrc = new Subject<Error>();

  private _subscriptions: Subscription[] = [];
  private isSelectedTab = false;
  private _lazyLoaded = false;
  private _isRefreshing = false;
  private _baseRowData: AddonViewModel[] = [];
  private _lastSelectionState: RowNode[] = [];

  public readonly operationError$ = this._operationErrorSrc.asObservable();

  public updateAllContextMenu: MatMenuTrigger;
  public spinnerMessage = "";
  public contextMenuPosition = { x: "0px", y: "0px" };
  public filter = "";
  public overlayNoRowsTemplate = "";
  public addonUtils = AddonUtils;
  public selectedClient = WowClientType.None;
  public selectedInstallation: WowInstallation = undefined;
  public wowClientType = WowClientType;
  public overlayRef: OverlayRef | null;
  public isBusy = true;
  public enableControls = true;
  public wowInstallations$: Observable<WowInstallation[]>;
  public selectedInstallationId: string;
  public rowData: AddonViewModel[] = [];
  public filterInput$ = new Subject<string>();
  public rowDataChange$ = new Subject<boolean>();

  // Grid
  public columnDefs: ColDef[] = [];
  public frameworkComponents = {};
  public gridApi: GridApi;
  public gridColumnApi: ColumnApi;
  public rowClassRules = {
    ignored: (params: RowClassParams): boolean => {
      return params.data.addon.isIgnored === true;
    },
  };

  public columns: ColumnState[] = [
    {
      name: "name",
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
      name: "latestVersion",
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
      name: "gameVersion",
      display: "PAGES.MY_ADDONS.TABLE.GAME_VERSION_COLUMN_HEADER",
      visible: true,
      allowToggle: true,
    },
    {
      name: "externalChannel",
      display: "PAGES.MY_ADDONS.TABLE.PROVIDER_RELEASE_CHANNEL",
      visible: false,
      allowToggle: true,
    },
    {
      name: "providerName",
      display: "PAGES.MY_ADDONS.TABLE.PROVIDER_COLUMN_HEADER",
      visible: true,
      allowToggle: true,
    },
    {
      name: "author",
      display: "PAGES.MY_ADDONS.TABLE.AUTHOR_COLUMN_HEADER",
      visible: true,
      allowToggle: true,
    },
  ];

  public get displayedColumns(): string[] {
    return this.columns.filter((col) => col.visible).map((col) => col.name);
  }

  public get enableUpdateAll(): boolean {
    return _.some(this._baseRowData, (row) => AddonUtils.needsUpdate(row.addon));
  }

  public get hasData(): boolean {
    return this._baseRowData.length > 0;
  }

  public constructor(
    private _sessionService: SessionService,
    private _dialog: MatDialog,
    private _dialogFactory: DialogFactory,
    private _cdRef: ChangeDetectorRef,
    private _wowUpAddonService: WowUpAddonService,
    private _translateService: TranslateService,
    private _snackbarService: SnackbarService,
    public addonService: AddonService,
    public electronService: ElectronService,
    public overlay: Overlay,
    public warcraftService: WarcraftService,
    public wowUpService: WowUpService,
    public warcraftInstallationService: WarcraftInstallationService,
    public relativeDurationPipe: RelativeDurationPipe
  ) {
    this.overlayNoRowsTemplate = `<span class="text-1 mat-h1">${
      _translateService.instant("COMMON.SEARCH.NO_ADDONS") as string
    }</span>`;

    this.wowInstallations$ = warcraftInstallationService.wowInstallations$;

    // When the search input changes debounce it a little before searching
    const filterInputSub = this.filterInput$.pipe(debounceTime(200)).subscribe(() => {
      this.filterAddons();
    });

    const addonInstalledSub = this.addonService.addonInstalled$
      .pipe(
        map((evt) => this.onAddonInstalledEvent(evt)),
        map(() => this.setPageContextText())
      )
      .subscribe();

    const addonRemovedSub = this.addonService.addonRemoved$
      .pipe(
        map((evt) => this.onAddonRemoved(evt)),
        map(() => this.setPageContextText())
      )
      .subscribe();

    this._subscriptions.push(
      this._sessionService.selectedHomeTab$.subscribe(this.onSelectedTabChange),
      this._sessionService.addonsChanged$.pipe(switchMap(() => from(this.onRefresh()))).subscribe(),
      this._sessionService.targetFileInstallComplete$.pipe(switchMap(() => from(this.onRefresh()))).subscribe(),
      addonInstalledSub,
      addonRemovedSub,
      filterInputSub
    );

    this.frameworkComponents = {
      myAddonRenderer: MyAddonsAddonCellComponent,
      myAddonStatus: MyAddonStatusColumnComponent,
      contextHeader: TableContextHeaderCellComponent,
      wrapTextCell: CellWrapTextComponent,
      dateTooltipCell: DateTooltipCellComponent,
    };

    this.columnDefs = this.createColumns();
  }

  public ngOnInit(): void {
    this._subscriptions.push(
      this.operationError$.subscribe({
        next: () => {
          this._snackbarService.showErrorSnackbar("PAGES.MY_ADDONS.ERROR_SNACKBAR");
        },
      })
    );

    const columnStates = this.wowUpService.getMyAddonsHiddenColumns();
    this.columns.forEach((col) => {
      if (!col.allowToggle) {
        return;
      }

      const state = _.find(columnStates, (cs) => cs.name === col.name);
      if (state) {
        col.visible = state.visible;
      }

      const columnDef = _.find(this.columnDefs, (cd) => cd.field === col.name);
      if (columnDef) {
        columnDef.hide = !col.visible;
      }
    });

    this.onSelectedTabChange(this._sessionService.getSelectedHomeTab());
  }

  public ngOnDestroy(): void {
    this._subscriptions.forEach((sub) => sub.unsubscribe());
  }

  public handleKeyboardEvent(event: KeyboardEvent): void {
    if (this.selectAllRows(event)) {
      return;
    }
  }

  public onSortChanged(evt: SortChangedEvent): void {
    const columnState = evt.columnApi.getColumnState();
    const minmialState = columnState.map((column) => {
      return {
        colId: column.colId,
        sort: column.sort,
      };
    });
    this.wowUpService.setMyAddonsSortOrder(minmialState);
  }

  public onRowDataChanged(): void {
    this.rowDataChange$.next(true);
  }

  public onFirstDataRendered(): void {
    this.autoSizeColumns();
  }

  public onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    this.gridColumnApi = params.columnApi;

    // Set initial sort order
    this.gridColumnApi.applyColumnState({
      state: [
        {
          colId: "sortOrder",
          sort: "asc",
        },
      ],
      defaultState: { sort: null },
    });

    this.loadSortOrder();

    this.rowDataChange$.pipe(debounceTime(50)).subscribe(() => {
      this.redrawRows();
    });
  }

  public ngAfterViewInit(): void {
    this._sessionService.autoUpdateComplete$
      .pipe(
        tap(() => console.log("Checking for addon updates...")),
        switchMap(() => from(this.loadAddons(this.selectedInstallation)))
      )
      .subscribe(() => {
        this._cdRef.markForCheck();
      });
  }

  public onSelectedTabChange = (tabIndex: number): void => {
    this.isSelectedTab = tabIndex === this.tabIndex;
    if (!this.isSelectedTab) {
      return;
    }

    this.setPageContextText();
    this.lazyLoad()
      .then(() => {
        this.redrawRows();
      })
      .catch((e) => console.error(e));
    // window.setTimeout(() => {}, 50);
  };

  // Get the translated value of the provider name (unknown)
  // If the key is returned there's nothing to translate return the normal name
  public getProviderName(providerName: string): string {
    const key = `APP.PROVIDERS.${providerName.toUpperCase()}`;
    const tx = this._translateService.instant(key);
    return tx === key ? providerName : tx;
  }

  public isLatestUpdateColumnVisible(): boolean {
    return this.columns.find((column) => column.name === "addon.latestVersion").visible;
  }

  public onRefresh = async (): Promise<void> => {
    if (this._isRefreshing) {
      return;
    }

    this._isRefreshing = true;
    this.isBusy = true;
    this.enableControls = false;

    try {
      console.debug("onRefresh");
      await this.addonService.syncAllClients();
      await this._wowUpAddonService.updateForInstallation(this.selectedInstallation);
      await this.loadAddons(this.selectedInstallation);
    } catch (e) {
      console.error(`Failed to refresh addons`, e);
    } finally {
      this.isBusy = false;
      this.enableControls = true;
      this._isRefreshing = false;
    }
  };

  // See: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
  public selectAllRows(event: KeyboardEvent): boolean {
    if (!(event.ctrlKey || event.metaKey) || event.code !== "KeyA") {
      return false;
    }

    event.preventDefault();

    this.gridApi.selectAll();

    return true;
  }

  public canSetAutoUpdate(listItem: AddonViewModel): boolean {
    return listItem.addon.isIgnored === false && listItem.addon.warningType === undefined;
  }

  public canReInstall(listItem: AddonViewModel): boolean {
    return listItem.addon.warningType === undefined && this.addonService.canReinstall(listItem.addon);
  }

  /** Handle when the user enters new text into the filter box */
  public filterAddons(): void {
    if (this.filter.length === 0) {
      this.rowData = this._baseRowData;
      this._cdRef.detectChanges();
      return;
    }

    const filter = this.filter.trim().toLowerCase();
    const filtered = _.filter(this._baseRowData, (row) => this.filterListItem(row, filter));

    this.rowData = filtered;

    this._cdRef.detectChanges();
  }

  // Handle when the user clicks the clear button on the filter input box
  public onClearFilter(): void {
    this.filter = "";
    this.filterInput$.next(this.filter);
  }

  // Handle when the user clicks the update all button
  public async onUpdateAll(): Promise<void> {
    this.enableControls = false;

    const addons = await this.addonService.getAddons(this.selectedInstallation, false);
    try {
      const filteredAddons = _.filter(addons, (addon) => this.addonService.canUpdateAddon(addon));

      const promises = _.map(filteredAddons, async (addon) => {
        try {
          await this.addonService.updateAddon(addon.id);
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

  // Handle when the user clicks the update all retail/classic button
  public onUpdateAllRetailClassic(): void {
    const installations = this.warcraftInstallationService
      .getWowInstallations()
      .filter(
        (installation) =>
          installation.clientType === WowClientType.Retail || installation.clientType === WowClientType.ClassicEra
      );
    this.updateAllWithSpinner(...installations).catch((e) => console.error(e));
  }

  // Handle when the user clicks update all clients button
  public onUpdateAllClients(): void {
    this.updateAllWithSpinner(...this.warcraftInstallationService.getWowInstallations()).catch((e) => console.error(e));
  }

  public onHeaderContext = (event: MouseEvent): void => {
    event.preventDefault();
    this.updateContextMenuPosition(event);
    this.columnContextMenu.menuData = {
      columns: this.columns.filter((col) => col.allowToggle),
    };
    this.columnContextMenu.menu.focusFirstItem("mouse");
    this.columnContextMenu.openMenu();
  };

  public onCellContext(evt: CellContextMenuEvent): void {
    evt.event.preventDefault();
    this.updateContextMenuPosition(evt.event);

    const selectedRows = this.gridApi.getSelectedRows();
    // const selectedItems = this._dataSubject.value.filter((item) => item.selected);
    if (selectedRows.length > 1) {
      this.multiContextMenu.menuData = { listItems: selectedRows };
      this.multiContextMenu.menu.focusFirstItem("mouse");
      this.multiContextMenu.openMenu();
    } else {
      this.contextMenu.menuData = { listItem: evt.data };
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
    try {
      const tasks = _.map(listItems, (listItem) => this.addonService.installAddon(listItem.addon.id));
      await Promise.all(tasks);
    } catch (e) {
      console.error(`Failed to re-install addons`, e);
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
    const colState = this.columns.find((col) => col.name === column.name);
    colState.visible = event.checked;

    this.wowUpService.setMyAddonsHiddenColumns([...this.columns]);

    this.gridColumnApi.setColumnVisible(column.name, event.checked);

    if (column.name === "latestVersion") {
      const updates = [...this._baseRowData];
      updates.forEach((update) => (update.showUpdate = !event.checked));
      this.rowData = updates;
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public getRowNodeId = (data: any) => {
    return data.addon.id;
  };

  public onReScan(): void {
    const title = this._translateService.instant("PAGES.MY_ADDONS.RESCAN_FOLDERS_CONFIRMATION_TITLE");
    const message = this._translateService.instant("PAGES.MY_ADDONS.RESCAN_FOLDERS_CONFIRMATION_DESCRIPTION");
    const dialogRef = this._dialogFactory.getConfirmDialog(title, message);

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
    this.getRemoveAddonPrompt(addon.name)
      .afterClosed()
      .pipe(
        first(),
        switchMap((result) => {
          if (!result) {
            return of(undefined);
          }

          if (this.addonService.getRequiredDependencies(addon).length === 0) {
            return from(this.addonService.removeAddon(addon));
          } else {
            return this.getRemoveDependenciesPrompt(addon.name, addon.dependencies.length)
              .afterClosed()
              .pipe(
                switchMap((result) => from(this.addonService.removeAddon(addon, result))),
                switchMap(() => from(this.loadAddons(this.selectedInstallation)))
              );
          }
        })
      )
      .subscribe();
  }

  private getRemoveAddonPrompt(addonName: string): MatDialogRef<ConfirmDialogComponent, any> {
    const title: string = this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.TITLE", { count: 1 });
    const message1: string = this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ONE", {
      addonName,
    });
    const message2: string = this._translateService.instant(
      "PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ACTION_EXPLANATION"
    );
    const message = `${message1}\n\n${message2}`;

    return this._dialogFactory.getConfirmDialog(title, message);
  }

  private getRemoveDependenciesPrompt(
    addonName: string,
    dependencyCount: number
  ): MatDialogRef<ConfirmDialogComponent, any> {
    const title = this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.DEPENDENCY_TITLE");
    const message1: string = this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.DEPENDENCY_MESSAGE", {
      addonName,
      dependencyCount,
    });
    const message2: string = this._translateService.instant(
      "PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ACTION_EXPLANATION"
    );
    const message = `${message1}\n\n${message2}`;

    return this._dialogFactory.getConfirmDialog(title, message);
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
        first(),
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
    const rows = [...this._baseRowData];
    try {
      for (const listItem of listItems) {
        const row = _.find(rows, (r) => r.addon.id === listItem.addon.id);

        row.addon.isIgnored = isIgnored;
        if (isIgnored) {
          row.addon.autoUpdateEnabled = false;
        }

        this.addonService.saveAddon(row.addon);
      }

      this.rowData = rows;
    } catch (e) {
      console.error(`Failed to ignore addon(s)`, e);
    }
  }

  public onClickAutoUpdateAddon(listItem: AddonViewModel): void {
    this.onClickAutoUpdateAddons([listItem]);
  }

  public onRowClicked(event: RowClickedEvent): void {
    const selectedNodes = event.api.getSelectedNodes();

    if (
      selectedNodes.length === 1 &&
      this._lastSelectionState.length === 1 &&
      event.node.data.addon.id === this._lastSelectionState[0].data.addon.id
    ) {
      event.node.setSelected(false);
      this._lastSelectionState = [];
    } else {
      this._lastSelectionState = [...selectedNodes];
    }
  }

  public onRowDoubleClicked(evt: RowDoubleClickedEvent): void {
    this._dialogFactory.getAddonDetailsDialog(evt.data);
    evt.node.setSelected(true);
  }

  public onClickAutoUpdateAddons(listItems: AddonViewModel[]): void {
    const isAutoUpdate = _.every(listItems, (listItem) => listItem.addon.autoUpdateEnabled === false);
    const rows = [...this._baseRowData];
    try {
      for (const listItem of listItems) {
        const row = _.find(rows, (r) => r.addon.id === listItem.addon.id);

        row.addon.autoUpdateEnabled = isAutoUpdate;
        if (isAutoUpdate) {
          row.addon.isIgnored = false;
        }

        this.addonService.saveAddon(row.addon);
      }

      this.rowData = rows;
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
        first(),
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

  /**
   * Update a single addon with a new channel
   */
  public onSelectedAddonChannelChange = (evt: MatRadioChange, listItem: AddonViewModel): Promise<void> => {
    return this.onSelectedAddonsChannelChange(evt, [listItem]);
  };

  /**
   * Update a batch of addons with a new channel
   * We need to call load addons so we pull in any new updates for that channel
   */
  public onSelectedAddonsChannelChange = async (evt: MatRadioChange, listItems: AddonViewModel[]): Promise<void> => {
    try {
      for (const listItem of listItems) {
        listItem.addon.channelType = evt.value;
        this.addonService.saveAddon(listItem.addon);
      }

      await this.onRefresh();
    } catch (e) {
      console.error(`Failed to change addon channel`, e);
    }
  };

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
    const tableElem = ePath.find((tag) => tag.tagName === "AG-GRID-ANGULAR");
    if (tableElem) {
      return;
    }

    this.gridApi?.deselectAll();
  }

  private async lazyLoad(): Promise<void> {
    if (this._lazyLoaded) {
      return;
    }

    this._lazyLoaded = true;
    this.isBusy = true;
    this.enableControls = false;

    // TODO this shouldn't be here
    await this.addonService.backfillAddons();

    const selectedInstallationSub = this._sessionService.selectedWowInstallation$
      .pipe(
        debounceTime(300),
        switchMap((installation) => {
          // Installs will not be pre-selected on Linux, so wait for one to get added
          if (!installation) {
            return of(undefined);
          }

          this.selectedInstallation = installation;
          this.selectedInstallationId = installation.id;
          return from(this.loadAddons(this.selectedInstallation));
        }),
        catchError((e) => {
          console.error(`selectedInstallationSub failed`, e);
          return of(undefined);
        })
      )
      .subscribe();

    this._subscriptions.push(selectedInstallationSub);
  }

  private async updateAllWithSpinner(...installations: WowInstallation[]): Promise<void> {
    this.isBusy = true;
    this.spinnerMessage = this._translateService.instant("PAGES.MY_ADDONS.SPINNER.GATHERING_ADDONS");
    this.enableControls = false;

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
        await this.loadAddons(this.selectedInstallation);
        return;
      }

      this.spinnerMessage = this._translateService.instant("PAGES.MY_ADDONS.SPINNER.UPDATING", {
        updateCount: updatedCt,
        addonCount: addons.length,
      });

      for (const addon of addons) {
        updatedCt += 1;

        // Find the installation for this addon so we can show the correct name
        const installation = installations.find((inst) => inst.id === addon.installationId);

        this.spinnerMessage = this._translateService.instant("PAGES.MY_ADDONS.SPINNER.UPDATING_WITH_ADDON_NAME", {
          updateCount: updatedCt,
          addonCount: addons.length,
          clientType: installation.label,
          addonName: addon.name,
        });

        await this.addonService.updateAddon(addon.id);
      }

      await this.loadAddons(this.selectedInstallation);
    } catch (err) {
      console.error("Failed to update classic/retail", err);
      this.isBusy = false;
      this._cdRef.detectChanges();
    } finally {
      this.spinnerMessage = "";
      this.enableControls = this.calculateControlState();
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

  private updateContextMenuPosition(event: any): void {
    this.contextMenuPosition.x = `${event.clientX as number}px`;
    this.contextMenuPosition.y = `${event.clientY as number}px`;
  }

  private loadAddons = async (installation: WowInstallation, reScan = false): Promise<void> => {
    this.isBusy = true;
    this.enableControls = false;

    if (!installation) {
      console.warn("Skipping addon load installation unknown");
      return;
    }

    this.rowData = this._baseRowData = [];
    this._cdRef.detectChanges();

    try {
      let addons = await this.addonService.getAddons(installation, reScan);
      if (reScan) {
        await this.addonService.syncInstallationAddons(installation);
        addons = await this.addonService.getAddons(installation, false);
      }

      const rowData = this.formatAddons(addons);
      this.enableControls = this.calculateControlState();

      this._baseRowData = rowData;
      this.rowData = this._baseRowData;

      this.isBusy = false;
      this.setPageContextText();

      this._cdRef.detectChanges();
    } catch (e) {
      console.error(e);
      this.isBusy = false;
      this.enableControls = this.calculateControlState();
    } finally {
      this._cdRef.detectChanges();
    }
  };

  private formatAddons(addons: Addon[]): AddonViewModel[] {
    const showUpdate = !this.columns.find((col) => col.name === "latestVersion").visible;
    const viewModels = addons.map((addon) => {
      const listItem = new AddonViewModel(addon);

      if (!listItem.addon.installedVersion) {
        listItem.addon.installedVersion = "";
      }

      listItem.showUpdate = showUpdate;
      return listItem;
    });

    return _.orderBy(viewModels, (vm) => vm.name);
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

  private setPageContextText() {
    const itemsLength = this.rowData.length;
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

  private onAddonInstalledEvent = (evt: AddonUpdateEvent) => {
    try {
      if (evt.addon.installationId !== this.selectedInstallationId) {
        return;
      }

      if ([AddonInstallState.Complete, AddonInstallState.Error].includes(evt.installState) === false) {
        this.enableControls = false;
        return;
      }

      const idx = this._baseRowData.findIndex((r) => r.addon.id === evt.addon.id);

      // If we have a new addon, just put it at the end
      if (idx === -1) {
        this._baseRowData.push(new AddonViewModel(evt.addon));
        this._baseRowData = _.orderBy(this._baseRowData, (row) => row.addon.name);
      } else {
        this._baseRowData.splice(idx, 1, new AddonViewModel(evt.addon));
      }

      // Reorder everything by name to act as a sub-sort
      this.rowData = [...this._baseRowData];

      this.enableControls = this.calculateControlState();
    } finally {
      this._cdRef.detectChanges();
    }
  };

  private onAddonRemoved = (addonId: string) => {
    const listItemIdx = this._baseRowData.findIndex((li) => li.addon.id === addonId);
    this._baseRowData.splice(listItemIdx, 1);

    this.rowData = [...this._baseRowData];
    this._cdRef.detectChanges();
  };

  private showErrorMessage(title: string, message: string) {
    this._dialogFactory.getErrorDialog(title, message);
  }

  private calculateControlState(): boolean {
    return !this.addonService.isInstalling();
  }

  private loadSortOrder() {
    let savedSortOrder = this.wowUpService.getMyAddonsSortOrder();
    if (!Array.isArray(savedSortOrder) || savedSortOrder.length < 2) {
      console.info(`Legacy or missing sort order fixed`);
      this.wowUpService.setMyAddonsSortOrder([]);
      savedSortOrder = [];
    }

    if (savedSortOrder.length > 0) {
      this.gridColumnApi.setColumnState(savedSortOrder);
    }
  }

  private autoSizeColumns() {
    this.gridColumnApi?.autoSizeColumns([
      "installedAt",
      "latestVersion",
      "releasedAt",
      "gameVersion",
      "externalChannel",
      "providerName",
    ]);
  }

  private redrawRows() {
    this.gridApi?.redrawRows();
    this.gridApi?.resetRowHeights();
    this.autoSizeColumns();
    this._cdRef.detectChanges();
  }

  private createColumns(): ColDef[] {
    const baseColumn = {
      headerComponent: "contextHeader",
      headerComponentParams: {
        onHeaderContext: this.onHeaderContext,
      },
      cellStyle: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      },
      suppressMovable: true,
    };

    return [
      {
        field: "name",
        flex: 2,
        minWidth: 300,
        headerName: this._translateService.instant("PAGES.MY_ADDONS.TABLE.ADDON_COLUMN_HEADER"),
        sortable: true,
        autoHeight: true,
        cellRenderer: "myAddonRenderer",
        colId: "name",
        valueGetter: (params) => {
          return params.data.canonicalName;
        },
        ...baseColumn,
      },
      {
        field: "sortOrder",
        width: 150,
        sortable: true,
        headerName: this._translateService.instant("PAGES.MY_ADDONS.TABLE.STATUS_COLUMN_HEADER"),
        cellRenderer: "myAddonStatus",
        ...baseColumn,
      },
      {
        field: "installedAt",
        sortable: true,
        headerName: this._translateService.instant("PAGES.MY_ADDONS.TABLE.UPDATED_AT_COLUMN_HEADER"),
        ...baseColumn,
        cellRenderer: "dateTooltipCell",
      },
      {
        field: "latestVersion",
        sortable: true,
        headerName: this._translateService.instant("PAGES.MY_ADDONS.TABLE.LATEST_VERSION_COLUMN_HEADER"),
        ...baseColumn,
      },
      {
        field: "releasedAt",
        sortable: true,
        headerName: this._translateService.instant("PAGES.MY_ADDONS.TABLE.RELEASED_AT_COLUMN_HEADER"),
        ...baseColumn,
        cellRenderer: "dateTooltipCell",
      },
      {
        field: "gameVersion",
        sortable: true,
        minWidth: 125,
        headerName: this._translateService.instant("PAGES.MY_ADDONS.TABLE.GAME_VERSION_COLUMN_HEADER"),
        ...baseColumn,
      },
      {
        field: "externalChannel",
        sortable: true,
        flex: 1,
        minWidth: 125,
        headerName: this._translateService.instant("PAGES.MY_ADDONS.TABLE.PROVIDER_RELEASE_CHANNEL"),
        ...baseColumn,
      },
      {
        field: "providerName",
        sortable: true,
        headerName: this._translateService.instant("PAGES.MY_ADDONS.TABLE.PROVIDER_COLUMN_HEADER"),
        valueFormatter: (row) => this.getProviderName(row.data.providerName),
        ...baseColumn,
      },
      {
        field: "author",
        sortable: true,
        minWidth: 120,
        flex: 1,
        headerName: this._translateService.instant("PAGES.MY_ADDONS.TABLE.AUTHOR_COLUMN_HEADER"),
        cellRenderer: "wrapTextCell",
        ...baseColumn,
      },
    ];
  }
}
