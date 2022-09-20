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
import { BehaviorSubject, combineLatest, from, fromEvent, Observable, of, Subject, Subscription, zip } from "rxjs";
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  first,
  map,
  switchMap,
  takeUntil,
  tap,
} from "rxjs/operators";

import { Overlay, OverlayRef } from "@angular/cdk/overlay";
import {
  AfterViewInit,
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
import { TranslateService } from "@ngx-translate/core";

import { Addon } from "../../../common/entities/addon";
import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { AddonViewModel } from "../../business-objects/addon-view-model";
import { CellWrapTextComponent } from "../../components/common/cell-wrap-text/cell-wrap-text.component";
import { ConfirmDialogComponent } from "../../components/common/confirm-dialog/confirm-dialog.component";
import { DateTooltipCellComponent } from "../../components/addons/date-tooltip-cell/date-tooltip-cell.component";
import { MyAddonStatusCellComponent } from "../../components/addons/my-addon-status-cell/my-addon-status-cell.component";
import { MyAddonsAddonCellComponent } from "../../components/addons/my-addons-addon-cell/my-addons-addon-cell.component";
import { TableContextHeaderCellComponent } from "../../components/addons/table-context-header-cell/table-context-header-cell.component";
import { AddonInstallState } from "../../models/wowup/addon-install-state";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { ColumnState } from "../../models/wowup/column-state";
import { WowInstallation } from "../../../common/warcraft/wow-installation";
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
import { stringIncludes } from "../../utils/string.utils";
import { SortOrder } from "../../models/wowup/sort-order";
import { PushService } from "../../services/push/push.service";
import { AddonUiService } from "../../services/addons/addon-ui.service";
import { AddonManageDialogComponent } from "../../components/addons/addon-manage-dialog/addon-manage-dialog.component";
import { WtfBackupComponent } from "../../components/addons/wtf-backup/wtf-backup.component";
import { HasEventTargetAddRemove } from "rxjs/internal/observable/fromEvent";
import { AddonProviderFactory } from "../../services/addons/addon.provider.factory";
import { toInterfaceVersion } from "../../utils/addon.utils";

@Component({
  selector: "app-my-addons",
  templateUrl: "./my-addons.component.html",
  styleUrls: ["./my-addons.component.scss"],
})
export class MyAddonsComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input("tabIndex") public set tabIndex(value: number) {
    this._tabIndexSrc.next(value);
  }

  @ViewChild("addonContextMenuTrigger", { static: false }) public contextMenu!: MatMenuTrigger;
  @ViewChild("addonMultiContextMenuTrigger", { static: false }) public multiContextMenu!: MatMenuTrigger;
  @ViewChild("columnContextMenuTrigger", { static: false }) public columnContextMenu!: MatMenuTrigger;
  @ViewChild("addonFilter") public addonFilter: ElementRef;

  // @HostListener("window:keydown", ["$event"])
  private readonly _operationErrorSrc = new Subject<Error>();
  private readonly _isBusySrc = new BehaviorSubject<boolean>(true);
  private readonly _tabIndexSrc = new BehaviorSubject<number | undefined>(undefined);
  private readonly _baseRowDataSrc = new BehaviorSubject<AddonViewModel[]>([]);
  private readonly _filterInputSrc = new BehaviorSubject<string>("");
  private readonly _spinnerMessageSrc = new BehaviorSubject<string>("");
  private readonly _totalAvailableUpdateSrc = new BehaviorSubject<number>(0);
  private readonly _destroy$ = new Subject<boolean>();

  public readonly totalAvailableUpdateCt$ = this._totalAvailableUpdateSrc.asObservable();
  public readonly enableControls$ = this._sessionService.enableControls$;
  public readonly spinnerMessage$ = this._spinnerMessageSrc.asObservable();

  public readonly selectedWowInstallation$ = this._sessionService.selectedWowInstallation$;

  public readonly selectedWowInstallationLabel$ = this._sessionService.selectedWowInstallation$.pipe(
    map((wowInstall) => wowInstall?.label ?? "")
  );

  public readonly selectedWowInstallationId$ = this._sessionService.selectedWowInstallation$.pipe(
    map((wowInstall) => wowInstall?.id)
  );

  public readonly hasSelectedWowInstallationId$ = this._sessionService.selectedWowInstallation$.pipe(
    map((wowInstall) => wowInstall !== undefined)
  );

  public readonly isBusy$ = combineLatest([this._isBusySrc, this._addonService.syncing$]).pipe(
    map((vals) => _.some(vals))
  );

  public readonly filterInput$ = this._filterInputSrc.asObservable();

  public readonly rowData$ = combineLatest([this._baseRowDataSrc, this.filterInput$]).pipe(
    debounceTime(0),
    map(([rowData, filterVal]) => {
      return this.filterAddons(rowData, filterVal);
    })
  );

  public readonly hasData$ = this.rowData$.pipe(map((data) => data.length > 0));
  public readonly enableUpdateAll$ = combineLatest([this.enableControls$, this.rowData$]).pipe(
    map(([enableControls, rowData]) => {
      return enableControls && rowData.some((row) => AddonUtils.needsUpdate(row.addon));
    })
  );

  public readonly enableUpdateExtra$ = combineLatest([
    this.enableControls$,
    this._addonService.anyUpdatesAvailable$,
  ]).pipe(
    map(([enableControls, updatesAvailable]) => {
      return enableControls && updatesAvailable;
    })
  );

  public readonly hideGrid$ = combineLatest([this.isBusy$, this.hasData$]).pipe(
    map(([isBusy, hasData]) => {
      return isBusy || !hasData;
    })
  );

  public readonly showNoAddons$ = combineLatest([this.isBusy$, this.hasData$]).pipe(
    map(([isBusy, hasData]) => {
      return !isBusy && !hasData;
    })
  );

  public readonly isSelectedTab$ = combineLatest([this._sessionService.selectedHomeTab$, this._tabIndexSrc]).pipe(
    map(([selectedTab, ownTab]) => {
      return selectedTab !== undefined && ownTab !== undefined && selectedTab === ownTab;
    })
  );

  public readonly operationError$ = this._operationErrorSrc.asObservable();

  private _subscriptions: Subscription[] = [];
  private _lazyLoaded = false;
  private _isRefreshing = false;
  private _lastSelectionState: RowNode[] = [];

  public updateAllContextMenu!: MatMenuTrigger;
  public contextMenuPosition = { x: "0px", y: "0px" };
  public overlayNoRowsTemplate = "";
  public addonUtils = AddonUtils;
  public overlayRef: OverlayRef | null = null;

  public wowInstallations$: Observable<WowInstallation[]>;

  // Grid
  public rowDataG: any[] = [];
  public columnDefs$ = new BehaviorSubject<ColDef[]>([]);
  public frameworkComponents = {};
  public gridApi!: GridApi;
  public gridColumnApi!: ColumnApi;
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

  public constructor(
    private _addonService: AddonService,
    private _addonProviderService: AddonProviderFactory,
    private _addonUiService: AddonUiService,
    private _sessionService: SessionService,
    private _dialog: MatDialog,
    private _dialogFactory: DialogFactory,
    private _cdRef: ChangeDetectorRef,
    private _wowUpAddonService: WowUpAddonService,
    private _translateService: TranslateService,
    private _snackbarService: SnackbarService,
    private _pushService: PushService,
    private _ngZone: NgZone,
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

    this.wowInstallations$ = combineLatest([
      warcraftInstallationService.wowInstallations$,
      _addonService.anyUpdatesAvailable$,
    ]).pipe(switchMap(([installations]) => from(this.mapInstallations(installations))));

    this._sessionService.rescanComplete$
      .pipe(
        takeUntil(this._destroy$),
        switchMap(() => from(this.onRefresh())),
        catchError((err) => {
          console.error(err);
          return of(undefined);
        })
      )
      .subscribe();

    const addonInstalledSub = this._addonService.addonInstalled$
      .pipe(
        map((evt) => this.onAddonInstalledEvent(evt)),
        map(() => this.setPageContextText())
      )
      .subscribe();

    const addonRemovedSub = this._addonService.addonRemoved$
      .pipe(
        map((evt) => this.onAddonRemoved(evt)),
        map(() => this.setPageContextText())
      )
      .subscribe();

    // If an update push comes in, check if we have any addons installed with any of the ids, if so refresh
    const pushUpdateSub = this._pushService.addonUpdate$
      .pipe(
        debounceTime(5000),
        switchMap((addons) => {
          const addonIds = addons.map((addon) => addon.addonId);
          return from(this._addonService.hasAnyWithExternalAddonIds(addonIds));
        }),
        filter((hasAny) => hasAny),
        switchMap(() => from(this.onRefresh()))
      )
      .subscribe();

    this._subscriptions.push(
      this.isSelectedTab$
        .pipe(
          filter((isSelected) => isSelected === true),
          switchMap(this.onSelectedTabChange)
        )
        .subscribe(),
      this._sessionService.addonsChanged$.pipe(switchMap(() => from(this.onRefresh()))).subscribe(),
      this._sessionService.targetFileInstallComplete$.pipe(switchMap(() => from(this.onRefresh()))).subscribe(),
      pushUpdateSub,
      addonInstalledSub,
      addonRemovedSub
    );

    this.frameworkComponents = {
      myAddonRenderer: MyAddonsAddonCellComponent,
      myAddonStatus: MyAddonStatusCellComponent,
      contextHeader: TableContextHeaderCellComponent,
      wrapTextCell: CellWrapTextComponent,
      dateTooltipCell: DateTooltipCellComponent,
    };

    this.columnDefs$.next(this.createColumns());
  }

  public ngOnInit(): void {
    this._subscriptions.push(
      this.operationError$.subscribe({
        next: () => {
          this._snackbarService.showErrorSnackbar("PAGES.MY_ADDONS.ERROR_SNACKBAR");
        },
      })
    );

    this.wowUpService
      .getMyAddonsHiddenColumns()
      .then((columnStates) => {
        const colDefs = [...this.columnDefs$.value];

        this.columns.forEach((col) => {
          if (!col.allowToggle) {
            return;
          }

          const state = _.find(columnStates, (cs) => cs.name === col.name);
          if (state) {
            col.visible = state.visible;
          }

          const columnDef = _.find(colDefs, (cd) => cd.field === col.name);
          if (columnDef) {
            columnDef.hide = !col.visible;
          }
        });

        this.columnDefs$.next(colDefs);
        this._sessionService.myAddonsCompactVersion = !this.getLatestVersionColumnVisible();
      })
      .catch((e) => console.error(e));
  }

  public ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
    this._subscriptions.forEach((sub) => sub.unsubscribe());
  }

  public onClickClearFilter(): void {
    this.addonFilter.nativeElement.value = "";
    this._filterInputSrc.next("");
  }

  public handleKeyboardEvent(event: KeyboardEvent): void {
    if (this.selectAllRows(event)) {
      return;
    }
  }

  public async onSortChanged(evt: SortChangedEvent): Promise<void> {
    const columnState = evt.columnApi.getColumnState();
    console.debug("columnState", columnState);
    const minimalState = columnState.map((column) => {
      const sortOrder: SortOrder = {
        colId: column.colId ?? "",
        sort: column.sort ?? null,
      };
      return sortOrder;
    });

    try {
      await this.wowUpService.setMyAddonsSortOrder(minimalState);
    } catch (e) {
      console.error(e);
    }
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

    this.loadSortOrder().catch((e) => console.error(e));

    this.rowData$
      .pipe(
        tap((data) => {
          this.gridApi.setRowData(data);
          this.setPageContextText();
        })
      )
      .subscribe();
  }

  public ngAfterViewInit(): void {
    this._sessionService.myAddonsCompactVersion = !this.getLatestVersionColumnVisible();

    if (this.addonFilter?.nativeElement !== undefined) {
      const addonFilterSub = fromEvent(this.addonFilter.nativeElement as HasEventTargetAddRemove<unknown>, "keyup")
        .pipe(
          filter(Boolean),
          debounceTime(200),
          distinctUntilChanged(),
          tap(() => {
            const val: string = this.addonFilter.nativeElement.value.toString();
            console.debug(val);
            this._filterInputSrc.next(val);
          })
        )
        .subscribe();

      this._subscriptions.push(addonFilterSub);
    }

    this._sessionService.autoUpdateComplete$
      .pipe(
        tap(() => console.log("Checking for addon updates...")),
        switchMap(() => from(this.loadAddons()))
      )
      .subscribe(() => {
        this._cdRef.markForCheck();
      });
  }

  public onSelectedTabChange = (): Observable<void> => {
    this.setPageContextText();

    return from(this.lazyLoad()).pipe(
      first(),
      catchError((e) => {
        console.error(e);
        return of(undefined);
      })
    );
  };

  // Get the translated value of the provider name (unknown)
  // If the key is returned there's nothing to translate return the normal name
  public getProviderName(providerName: string): string {
    const key = `APP.PROVIDERS.${providerName.toUpperCase()}`;
    const tx = this._translateService.instant(key);
    return tx === key ? providerName : tx;
  }

  public isLatestUpdateColumnVisible(): boolean {
    return this.columns.find((column) => column.name === "addon.latestVersion")?.visible ?? false;
  }

  public onRefresh = async (): Promise<void> => {
    if (this._isRefreshing) {
      return;
    }

    this._isRefreshing = true;
    this._isBusySrc.next(true);
    this._sessionService.setEnableControls(false);

    try {
      console.debug("onRefresh");
      await this._addonService.syncAllClients();

      const selectedWowInstall = this._sessionService.getSelectedWowInstallation();
      if (selectedWowInstall !== undefined) {
        await this._wowUpAddonService.updateForInstallation(selectedWowInstall);
      }

      await this.loadAddons();
      await this.updateBadgeCount();
    } catch (e) {
      console.error(`Failed to refresh addons`, e);
    } finally {
      this._isBusySrc.next(false);

      this._sessionService.setEnableControls(true);

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
    if (!listItem.addon) {
      return false;
    }

    return listItem.addon.isIgnored === false && listItem.addon.warningType === undefined;
  }

  public async canSetAutoUpdateNotifications(listItem: AddonViewModel): Promise<boolean> {
    if (!listItem.addon) {
      return false;
    }

    const enableSystemNotifications = await this.wowUpService.getEnableSystemNotifications();
    if (enableSystemNotifications === false) {
      return false;
    }

    return (
      listItem.addon.isIgnored === false && listItem.addon.warningType === undefined && listItem.addon.autoUpdateEnabled
    );
  }

  public isForceIgnore(addon: Addon) {
    return this._addonProviderService.isForceIgnore(addon.providerName);
  }

  public canReInstall(listItem: AddonViewModel): boolean {
    if (!listItem.addon) {
      return false;
    }

    return (
      listItem.addon.warningType === undefined && this._addonProviderService.canReinstall(listItem.addon.providerName)
    );
  }

  public canChangeChannel(addon: Addon) {
    return this._addonProviderService.canChangeChannel(addon.providerName);
  }

  public filterAddons(rowData: AddonViewModel[], filterVal: string): AddonViewModel[] {
    if (filterVal.length === 0) {
      return rowData;
    }

    const filter = filterVal.trim().toLowerCase();
    return rowData.filter((row) => this.filterListItem(row, filter));
  }

  // Handle when the user clicks the update all button
  public async onUpdateAll(): Promise<void> {
    const selectedWowInstall = this._sessionService.getSelectedWowInstallation();
    if (selectedWowInstall === undefined) {
      return;
    }

    this._sessionService.setEnableControls(false);

    const addons = await this._addonService.getAddons(selectedWowInstall, false);
    try {
      const filteredAddons = _.filter(addons, (addon) => AddonUtils.needsUpdate(addon));

      const promises = _.map(filteredAddons, async (addon) => {
        try {
          await this._addonService.updateAddon(addon.id ?? "");
        } catch (e) {
          console.error("Failed to install", e);
        }
      });

      await Promise.all(promises);
    } catch (err) {
      console.error(err);
    }

    this._sessionService.setEnableControls(this.calculateControlState());
  }

  // Handle when the user clicks the update all retail/classic button
  public async onUpdateAllRetailClassic(): Promise<void> {
    let installations = await this.warcraftInstallationService.getWowInstallationsAsync();
    installations = installations.filter(
      (installation) =>
        installation.clientType === WowClientType.Retail || installation.clientType === WowClientType.ClassicEra
    );
    this.updateAllWithSpinner(...installations).catch((e) => console.error(e));
  }

  // Handle when the user clicks update all clients button
  public async onUpdateAllClients(): Promise<void> {
    const installations = await this.warcraftInstallationService.getWowInstallationsAsync();
    this.updateAllWithSpinner(...installations).catch((e) => console.error(e));
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
    evt?.event?.preventDefault();
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
      console.debug("onReInstallAddons", listItems);
      const tasks = _.map(listItems, (listItem) => this._addonService.installAddon(listItem.addon?.id ?? ""));
      await Promise.all(tasks);
    } catch (e) {
      console.error(`Failed to re-install addons`, e);
    }
  }

  public async onShowFolder(addon: Addon, folder: string): Promise<void> {
    try {
      const addonPath = this._addonService.getInstallBasePath(addon);
      const folderPath = join(addonPath, folder);
      await this.electronService.openPath(folderPath);
    } catch (err) {
      console.error(err);
    }
  }

  public async onColumnVisibleChange(event: MatCheckboxChange, column: ColumnState): Promise<void> {
    const colState = this.columns.find((col) => col.name === column.name);
    if (!colState) {
      console.warn(`Column state not found: ${column.name}`);
      return;
    }

    colState.visible = event.checked;

    await this.wowUpService.setMyAddonsHiddenColumns([...this.columns]);

    this.gridColumnApi.setColumnVisible(column.name, event.checked);

    if (column.name === "latestVersion") {
      this._sessionService.myAddonsCompactVersion = !event.checked;
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public getRowNodeId = (data: any) => {
    return data.data.addon.id;
  };

  public onClickCreateBackup(): void {
    const dialogRef = this._dialogFactory.getDialog(WtfBackupComponent, {
      disableClose: true,
      data: {},
    });

    dialogRef.afterClosed().pipe(first()).subscribe();
  }

  public onClickImportExport(): void {
    const dialogRef = this._dialogFactory.getDialog(AddonManageDialogComponent, {
      disableClose: true,
      data: {},
    });

    dialogRef.afterClosed().pipe(first()).subscribe();
  }

  public onReScan(): void {
    const title: string = this._translateService.instant("PAGES.MY_ADDONS.RESCAN_FOLDERS_CONFIRMATION_TITLE");
    const message: string = this._translateService.instant("PAGES.MY_ADDONS.RESCAN_FOLDERS_CONFIRMATION_DESCRIPTION");
    const dialogRef = this._dialogFactory.getConfirmDialog(title, message);

    dialogRef
      .afterClosed()
      .pipe(
        first(),
        switchMap((result) => {
          if (!result) {
            return of(undefined);
          }

          console.log("Performing re-scan");
          return from(this.loadAddons(true)).pipe(switchMap(() => from(this.onRefresh())));
        })
      )
      .subscribe();
  }

  public async onClientChange(evt: any): Promise<void> {
    const val: string = evt.value.toString();
    await this._sessionService.setSelectedWowInstallation(val);
  }

  public onRemoveAddon(addon: Addon): void {
    this._addonUiService
      .handleRemoveAddon(addon)
      .pipe(
        first(),
        switchMap((result) => {
          return result.dependenciesRemoved ? this.loadAddons() : of(undefined);
        })
      )
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
      listItems.forEach((listItem) => (message = `${message}\n\t• ${listItem.addon?.name ?? ""}`));
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

          return zip(listItems.map((listItem) => from(this._addonService.removeAddon(listItem.addon))));
        })
      )
      .subscribe();
  }

  public async onClickIgnoreAddon(listItem: AddonViewModel): Promise<void> {
    await this.onClickIgnoreAddons([listItem]);
  }

  public async onClickIgnoreAddons(listItems: AddonViewModel[]): Promise<void> {
    const isIgnored = _.every(listItems, (listItem) => listItem.addon?.isIgnored === false);
    const rows = _.cloneDeep(this._baseRowDataSrc.value);
    try {
      for (const listItem of listItems) {
        const row = _.find(rows, (r) => r.addon?.id === listItem.addon?.id);
        if (!row || !row.addon) {
          console.warn(`Invalid row data`);
          continue;
        }

        row.addon.isIgnored = isIgnored;
        if (isIgnored) {
          row.addon.autoUpdateEnabled = false;
        }

        await this._addonService.saveAddon(row.addon);
      }

      this._baseRowDataSrc.next(rows);
    } catch (e) {
      console.error(`Failed to ignore addon(s)`, e);
    } finally {
      this.updateBadgeCount().catch((e) => console.error(e));
    }
  }

  public async onClickAutoUpdateAddon(listItem: AddonViewModel): Promise<void> {
    await this.onClickAutoUpdateAddons([listItem]);
  }

  public async onClickAutoUpdateAddonNotifications(listItem: AddonViewModel): Promise<void> {
    await this.onClickAutoUpdateAddonsNotifications([listItem]);
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
    this._dialogFactory.getAddonDetailsDialog(evt.data as AddonViewModel);
    evt.node.setSelected(true);
  }

  private getModelById(rows: AddonViewModel[], model: AddonViewModel): AddonViewModel | undefined {
    return rows.find((row) => row.addon?.id == model.addon?.id);
  }

  public async onClickAutoUpdateAddons(listItems: AddonViewModel[]): Promise<void> {
    const isAutoUpdate = _.every(listItems, (listItem) => listItem.addon?.autoUpdateEnabled === false);
    const rows = _.cloneDeep(this._baseRowDataSrc.value);
    try {
      for (const listItem of listItems) {
        const row = this.getModelById(rows, listItem);
        if (!row || !row.addon) {
          console.warn("Invalid row data");
          continue;
        }

        row.addon.autoUpdateEnabled = isAutoUpdate;
        if (isAutoUpdate) {
          row.addon.isIgnored = false;
        }

        row.addon.autoUpdateNotificationsEnabled = isAutoUpdate;

        await this._addonService.saveAddon(row.addon);
      }

      this._baseRowDataSrc.next(rows);
    } catch (e) {
      console.error(e);
      this._operationErrorSrc.next(e as Error);
    }
  }

  public async onClickAutoUpdateAddonsNotifications(listItems: AddonViewModel[]): Promise<void> {
    const isAutoUpdateNofications = _.every(
      listItems,
      (listItem) => listItem.addon?.autoUpdateNotificationsEnabled === false
    );
    const rows = _.cloneDeep(this._baseRowDataSrc.value);
    try {
      for (const listItem of listItems) {
        const row = _.find(rows, (r) => r.addon?.id === listItem.addon?.id);
        if (!row || !row.addon) {
          console.warn("Invalid row data for addon", listItem.addon?.id);
          continue;
        }

        row.addon.autoUpdateNotificationsEnabled = isAutoUpdateNofications;

        await this._addonService.saveAddon(row.addon);
      }

      this._baseRowDataSrc.next(rows);
    } catch (e) {
      console.error(e);
      this._operationErrorSrc.next(e as Error);
    }
  }

  public onSelectedProviderChange(evt: MatRadioChange, listItem: AddonViewModel): void {
    const messageData = {
      addonName: listItem.addon?.name ?? "",
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

          const selectedWowInstall = this._sessionService.getSelectedWowInstallation();
          const externalId = _.find(listItem.addon?.externalIds, (extId) => extId.providerName === evt.value);
          if (!externalId || !selectedWowInstall) {
            throw new Error("External id not found");
          }

          return from(
            this._addonService.setProvider(listItem.addon, externalId.id, externalId.providerName, selectedWowInstall)
          );
        }),
        catchError((e) => {
          console.error(e);
          const errorTitle: string = this._translateService.instant("DIALOGS.ALERT.ERROR_TITLE");
          const errorMessage: string = this._translateService.instant(
            "COMMON.ERRORS.CHANGE_PROVIDER_ERROR",
            messageData
          );
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
        if (!listItem.addon) {
          console.warn("Invalid addon");
          continue;
        }

        listItem.addon.channelType = evt.value;
        await this._addonService.saveAddon(listItem.addon);
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
    const ePath = (evt as any).path as HTMLElement[];
    const tableElem = ePath.find((tag) => tag.tagName === "AG-GRID-ANGULAR");
    if (tableElem) {
      return;
    }

    evt.stopPropagation();
    evt.preventDefault();
    this._lastSelectionState = [];
    this.gridApi?.deselectAll();
  }

  private async lazyLoad(): Promise<void> {
    if (this._lazyLoaded) {
      return;
    }

    this._lazyLoaded = true;
    this._isBusySrc.next(true);

    this._sessionService.setEnableControls(false);

    // TODO this shouldn't be here
    await this._addonService.backfillAddons();

    const selectedInstallationSub = this._sessionService.selectedWowInstallation$
      .pipe(
        debounceTime(300),
        switchMap((installation) => {
          // Installs will not be pre-selected on Linux, so wait for one to get added
          if (!installation) {
            return of(undefined);
          }

          return from(this.loadAddons());
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
    this._isBusySrc.next(true);

    this._spinnerMessageSrc.next(this._translateService.instant("PAGES.MY_ADDONS.SPINNER.GATHERING_ADDONS") as string);
    this._sessionService.setEnableControls(false);

    let addons: Addon[] = [];
    let updatedCt = 0;

    try {
      for (const installation of installations) {
        addons = addons.concat(await this._addonService.getAddons(installation));
      }

      // Only care about the ones that need to be updated/installed
      addons = addons.filter(
        (addon) => !addon.isIgnored && (AddonUtils.needsUpdate(addon) || AddonUtils.needsInstall(addon))
      );

      if (addons.length === 0) {
        await this.loadAddons();
        return;
      }

      this._spinnerMessageSrc.next(
        this._translateService.instant("PAGES.MY_ADDONS.SPINNER.UPDATING", {
          updateCount: updatedCt,
          addonCount: addons.length,
        }) as string
      );

      for (const addon of addons) {
        if (!addon.id) {
          continue;
        }

        updatedCt += 1;

        // Find the installation for this addon so we can show the correct name
        const installation = installations.find((inst) => inst.id === addon.installationId);
        if (!installation) {
          console.warn("Installation not found");
          continue;
        }

        this._spinnerMessageSrc.next(
          this._translateService.instant("PAGES.MY_ADDONS.SPINNER.UPDATING_WITH_ADDON_NAME", {
            updateCount: updatedCt,
            addonCount: addons.length,
            clientType: installation.label,
            addonName: addon.name,
          }) as string
        );

        await this._addonService.updateAddon(addon.id);
      }

      await this.loadAddons();
    } catch (err) {
      console.error("Failed to update classic/retail", err);
      this._isBusySrc.next(false);

      this._cdRef.detectChanges();
    } finally {
      this._spinnerMessageSrc.next("");
      this._sessionService.setEnableControls(this.calculateControlState());
    }
  }

  private updateContextMenuPosition(event: any): void {
    this.contextMenuPosition.x = `${event.clientX as number}px`;
    this.contextMenuPosition.y = `${event.clientY as number}px`;
  }

  private loadAddons = async (reScan = false): Promise<void> => {
    const installation = this._sessionService.getSelectedWowInstallation();
    if (!installation) {
      return;
    }

    this._isBusySrc.next(true);

    this._sessionService.setEnableControls(false);

    if (!installation) {
      console.warn("Skipping addon load installation unknown");
      return;
    }

    this._cdRef.detectChanges();

    try {
      let addons: Addon[] = [];
      addons = await this._addonService.getAddons(installation, reScan);

      const rowData = this.formatAddons(addons);

      this._baseRowDataSrc.next(rowData);

      this.setPageContextText();

      this._cdRef.detectChanges();
    } catch (e) {
      console.error(e);
    } finally {
      this._isBusySrc.next(false);
      this._cdRef.detectChanges();
      this._sessionService.setEnableControls(this.calculateControlState());
    }
  };

  private getLatestVersionColumnVisible(): boolean {
    return this.columns.find((col) => col.name === "latestVersion")?.visible ?? true;
  }

  private formatAddons(addons: Addon[]): AddonViewModel[] {
    const viewModels = addons.map((addon) => {
      const listItem = new AddonViewModel(addon);

      if (listItem.addon && !listItem.addon.installedVersion) {
        listItem.addon.installedVersion = "";
      }

      return listItem;
    });

    return _.orderBy(viewModels, (vm) => vm.name);
  }

  private filterListItem = (item: AddonViewModel, filter: string) => {
    if (
      stringIncludes(item.addon?.name, filter) ||
      stringIncludes(item.addon?.latestVersion, filter) ||
      stringIncludes(item.addon?.author, filter)
    ) {
      return true;
    }
    return false;
  };

  private setPageContextText() {
    this.rowData$
      .pipe(
        first(),
        map((data) => {
          if (data.length === 0) {
            return;
          }

          this._sessionService.setContextText(
            this._tabIndexSrc.value,
            this._translateService.instant("PAGES.MY_ADDONS.PAGE_CONTEXT_FOOTER.ADDONS_INSTALLED", {
              count: data.length,
            }) as string
          );
        })
      )
      .subscribe();
  }

  private onAddonInstalledEvent = (evt: AddonUpdateEvent) => {
    if (evt.addon.installationId !== this._sessionService.getSelectedWowInstallation()?.id) {
      return;
    }

    if ([AddonInstallState.Complete, AddonInstallState.Error].includes(evt.installState) === false) {
      this._sessionService.setEnableControls(false);
      return;
    }

    let rowData = _.cloneDeep(this._baseRowDataSrc.value);
    const idx = rowData.findIndex((r) => r.addon?.id === evt.addon.id);

    // If we have a new addon, just put it at the end
    if (idx === -1) {
      console.debug("Adding new addon to list");
      rowData.push(new AddonViewModel(evt.addon));
      rowData = _.orderBy(rowData, (row) => row.canonicalName);
    } else {
      rowData.splice(idx, 1, new AddonViewModel(evt.addon));
    }

    this._baseRowDataSrc.next(rowData);
    this._sessionService.setEnableControls(this.calculateControlState());
  };

  private onAddonRemoved = (addonId: string) => {
    const rowData = _.cloneDeep(this._baseRowDataSrc.value);

    const listItemIdx = rowData.findIndex((li) => li.addon?.id === addonId);
    rowData.splice(listItemIdx, 1);

    this._baseRowDataSrc.next(rowData);
  };

  private showErrorMessage(title: string, message: string) {
    this._dialogFactory.getErrorDialog(title, message);
  }

  private calculateControlState(): boolean {
    return !this._addonService.isInstalling();
  }

  private async mapInstallations(installations: WowInstallation[]): Promise<WowInstallation[]> {
    let total = 0;
    for (const inst of installations) {
      const addons = await this._addonService.getAllAddonsAvailableForUpdate(inst);
      inst.availableUpdateCount = addons.length;
      total += inst.availableUpdateCount;
    }

    this._totalAvailableUpdateSrc.next(total);
    return installations;
  }

  private async updateBadgeCount(): Promise<void> {
    const addons = await this._addonService.getAllAddonsAvailableForUpdate();
    const ct = addons.length;
    console.debug("updateBadgeCount", ct);
    try {
      await this.wowUpService.updateAppBadgeCount(ct);
    } catch (e) {
      console.error("Failed to update badge count", e);
    }
  }

  private async loadSortOrder(): Promise<void> {
    let savedSortOrder = await this.wowUpService.getMyAddonsSortOrder();
    if (!Array.isArray(savedSortOrder) || savedSortOrder.length < 2) {
      console.info(`Legacy or missing sort order fixed`);
      await this.wowUpService.setMyAddonsSortOrder([]);
      savedSortOrder = [];
    }

    if (savedSortOrder.length > 0) {
      this.gridColumnApi.applyColumnState({
        state: savedSortOrder,
      });
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

  // Sort the toc version column by converting from 'x.x.x' to interface version 'xxxxxx'
  private compareTocVersion(nodeA: RowNode, nodeB: RowNode): number {
    const v1 = (nodeA.data["gameVersion"] as string)?.trim();
    const v2 = (nodeB.data["gameVersion"] as string)?.trim();

    const iv1 = toInterfaceVersion(v1 || "0.0.0");
    const iv2 = toInterfaceVersion(v2 || "0.0.0");

    return iv1 > iv2 ? 1 : -1;
  }

  // If nodes have the same primary value, use the canonical name as a fallback
  private compareElement(nodeA: RowNode, nodeB: RowNode, prop: string): number {
    if (nodeA.data[prop] === nodeB.data[prop]) {
      if (nodeA.data.canonicalName === nodeB.data.canonicalName) {
        return 0;
      }
      return nodeA.data.canonicalName > nodeB.data.canonicalName ? 1 : -1;
    }

    return nodeA.data[prop] > nodeB.data[prop] ? 1 : -1;
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
        cellRenderer: "myAddonRenderer",
        field: "hash",
        flex: 2,
        minWidth: 300,
        headerName: this._translateService.instant("PAGES.MY_ADDONS.TABLE.ADDON_COLUMN_HEADER"),
        sortable: true,
        // autoHeight: true,
        colId: "name",
        comparator: (va, vb, na, nb) => this.compareElement(na, nb, "canonicalName"),
        ...baseColumn,
      },
      {
        cellRenderer: "myAddonStatus",
        comparator: (va, vb, na, nb) => this.compareElement(na, nb, "sortOrder"),
        field: "sortOrder",
        headerName: this._translateService.instant("PAGES.MY_ADDONS.TABLE.STATUS_COLUMN_HEADER"),
        sortable: true,
        width: 150,
        ...baseColumn,
      },
      {
        field: "installedAt",
        sortable: true,
        headerName: this._translateService.instant("PAGES.MY_ADDONS.TABLE.UPDATED_AT_COLUMN_HEADER"),
        comparator: (va, vb, na, nb) => this.compareElement(na, nb, "installedAt"),
        ...baseColumn,
        cellRenderer: "dateTooltipCell",
      },
      {
        field: "latestVersion",
        sortable: true,
        headerName: this._translateService.instant("PAGES.MY_ADDONS.TABLE.LATEST_VERSION_COLUMN_HEADER"),
        comparator: (va, vb, na, nb) => this.compareElement(na, nb, "latestVersion"),
        ...baseColumn,
      },
      {
        field: "releasedAt",
        sortable: true,
        headerName: this._translateService.instant("PAGES.MY_ADDONS.TABLE.RELEASED_AT_COLUMN_HEADER"),
        comparator: (va, vb, na, nb) => this.compareElement(na, nb, "releasedAt"),
        ...baseColumn,
        cellRenderer: "dateTooltipCell",
      },
      {
        field: "gameVersion",
        sortable: true,
        minWidth: 125,
        headerName: this._translateService.instant("PAGES.MY_ADDONS.TABLE.GAME_VERSION_COLUMN_HEADER"),
        comparator: (va, vb, na, nb) => this.compareTocVersion(na, nb),
        ...baseColumn,
      },
      {
        field: "externalChannel",
        sortable: true,
        flex: 1,
        minWidth: 125,
        headerName: this._translateService.instant("PAGES.MY_ADDONS.TABLE.PROVIDER_RELEASE_CHANNEL"),
        comparator: (va, vb, na, nb) => this.compareElement(na, nb, "externalChannel"),
        ...baseColumn,
      },
      {
        field: "providerName",
        sortable: true,
        headerName: this._translateService.instant("PAGES.MY_ADDONS.TABLE.PROVIDER_COLUMN_HEADER"),
        valueFormatter: (row) => this.getProviderName(row.data.providerName as string),
        comparator: (va, vb, na, nb) => this.compareElement(na, nb, "providerName"),
        ...baseColumn,
      },
      {
        field: "author",
        sortable: true,
        minWidth: 120,
        flex: 1,
        headerName: this._translateService.instant("PAGES.MY_ADDONS.TABLE.AUTHOR_COLUMN_HEADER"),
        comparator: (va, vb, na, nb) => this.compareElement(na, nb, "author"),
        cellRenderer: "wrapTextCell",
        ...baseColumn,
      },
    ];
  }
}
