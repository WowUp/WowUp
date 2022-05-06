import {
  ColDef,
  ColumnApi,
  GridApi,
  GridReadyEvent,
  RowClickedEvent,
  RowDoubleClickedEvent,
  RowNode,
} from "ag-grid-community";
import * as _ from "lodash";
import { BehaviorSubject, combineLatest, from, Observable, of, Subject } from "rxjs";
import { catchError, filter, first, map, switchMap, takeUntil } from "rxjs/operators";

import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { MatCheckboxChange } from "@angular/material/checkbox";
import { MatDialog } from "@angular/material/dialog";
import { MatMenuTrigger } from "@angular/material/menu";
import { MatDrawer } from "@angular/material/sidenav";
import { TranslateService } from "@ngx-translate/core";

import {
  ADDON_PROVIDER_HUB,
  ADDON_PROVIDER_WAGO,
  DEFAULT_CHANNEL_PREFERENCE_KEY_SUFFIX,
} from "../../../common/constants";
import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { AddonCategory, AddonChannelType } from "../../../common/wowup/models";
import { GetAddonListItem } from "../../business-objects/get-addon-list-item";
import { CellWrapTextComponent } from "../../components/common/cell-wrap-text/cell-wrap-text.component";
import { GetAddonStatusColumnComponent } from "../../components/addons/get-addon-status-cell/get-addon-status-cell.component";
import { InstallFromUrlDialogComponent } from "../../components/addons/install-from-url-dialog/install-from-url-dialog.component";
import {
  PotentialAddonTableCellComponent,
  PotentialAddonViewDetailsEvent,
} from "../../components/addons/potential-addon-table-cell/potential-addon-table-cell.component";
import { TableContextHeaderCellComponent } from "../../components/addons/table-context-header-cell/table-context-header-cell.component";
import { GenericProviderError } from "../../errors";
import { AddonSearchResult } from "../../models/wowup/addon-search-result";
import { ColumnState } from "../../models/wowup/column-state";
import { DownloadCountPipe } from "../../pipes/download-count.pipe";
import { RelativeDurationPipe } from "../../pipes/relative-duration-pipe";
import { ElectronService } from "../../services";
import { AddonService } from "../../services/addons/addon.service";
import { DialogFactory } from "../../services/dialog/dialog.factory";
import { SessionService } from "../../services/session/session.service";
import { SnackbarService } from "../../services/snackbar/snackbar.service";
import { WarcraftInstallationService } from "../../services/warcraft/warcraft-installation.service";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { getEnumKeys } from "../../utils/enum.utils";
import { camelToSnakeCase } from "../../utils/string.utils";
import { WowInstallation } from "../../../common/warcraft/wow-installation";
import { AddonProviderFactory } from "../../services/addons/addon.provider.factory";

interface CategoryItem {
  category: AddonCategory;
  localeKey: string;
}

@Component({
  selector: "app-get-addons",
  templateUrl: "./get-addons.component.html",
  styleUrls: ["./get-addons.component.scss"],
})
export class GetAddonsComponent implements OnInit, OnDestroy {
  @Input("tabIndex") public tabIndex!: number;

  @ViewChild("columnContextMenuTrigger") public columnContextMenu!: MatMenuTrigger;
  @ViewChild("drawer") public drawer!: MatDrawer;

  private readonly _destroy$ = new Subject<boolean>();

  private _isSelectedTab = false;
  private _lazyLoaded = false;
  private _rowDataSrc = new BehaviorSubject<GetAddonListItem[]>([]);
  private _lastSelectionState: RowNode[] = [];
  private _selectedAddonCategory: CategoryItem | undefined;

  public addonCategory = AddonCategory;
  public columnDefs$ = new BehaviorSubject<ColDef[]>([]);
  public rowData$ = this._rowDataSrc.asObservable();
  public enableControls$ = this._sessionService.enableControls$;
  public frameworkComponents = {};
  public columnTypes: {
    [key: string]: ColDef;
  } = { nonEditableColumn: { editable: false } };

  public columnStates: ColumnState[] = [
    { name: "name", display: "PAGES.GET_ADDONS.TABLE.ADDON_COLUMN_HEADER", visible: true },
    {
      name: "downloadCount",
      display: "PAGES.GET_ADDONS.TABLE.DOWNLOAD_COUNT_COLUMN_HEADER",
      visible: true,
      allowToggle: true,
    },
    {
      name: "releasedAt",
      display: "PAGES.GET_ADDONS.TABLE.RELEASED_AT_COLUMN_HEADER",
      visible: true,
      allowToggle: true,
    },
    { name: "author", display: "PAGES.GET_ADDONS.TABLE.AUTHOR_COLUMN_HEADER", visible: true, allowToggle: true },
    {
      name: "providerName",
      display: "PAGES.GET_ADDONS.TABLE.PROVIDER_COLUMN_HEADER",
      visible: true,
      allowToggle: false,
    },
    { name: "status", display: "PAGES.GET_ADDONS.TABLE.STATUS_COLUMN_HEADER", visible: true },
  ];

  public get defaultAddonChannel(): AddonChannelType | undefined {
    const installation = this._sessionService.getSelectedWowInstallation();
    return installation?.defaultAddonChannelType ?? undefined;
  }

  public query = "";
  public selectedClient = WowClientType.None;
  public selectedInstallation: WowInstallation | undefined = undefined;
  public selectedInstallationId = "";
  public contextMenuPosition = { x: "0px", y: "0px" };
  public wowInstallations$: Observable<WowInstallation[]>;
  public overlayNoRowsTemplate = "";

  public hasData$ = this.rowData$.pipe(map((data) => data.length > 0));

  private _showTableSrc = new BehaviorSubject<boolean>(false);
  public readonly showTable$ = combineLatest([this._showTableSrc, this.hasData$]).pipe(
    map(([enabled]) => {
      return enabled === true;
    })
  );

  public gridApi!: GridApi;
  public gridColumnApi!: ColumnApi;

  public addonCategories: CategoryItem[] = [];

  public get selectedAddonCategory(): CategoryItem | undefined {
    return this._selectedAddonCategory;
  }

  public set selectedAddonCategory(categoryItem: CategoryItem | undefined) {
    this._selectedAddonCategory = categoryItem;
    this.drawer?.close().catch((e) => console.error(e));

    if (!this.selectedInstallation || !categoryItem) {
      return;
    }

    if (categoryItem.category === AddonCategory.AllAddons) {
      this.loadPopularAddons(this.selectedInstallation);
      return;
    }

    this._sessionService.setEnableControls(false);
    this._showTableSrc.next(false);

    of(true)
      .pipe(
        first(),
        switchMap(() => {
          return this.selectedInstallation
            ? from(this._addonService.getCategoryPage(categoryItem.category, this.selectedInstallation))
            : of([] as AddonSearchResult[]);
        }),
        map((searchResults) => {
          const searchListItems = this.formatAddons(searchResults);
          this._rowDataSrc.next(searchListItems);
          this._showTableSrc.next(true);
          this._sessionService.setEnableControls(true);
        }),
        catchError((error) => {
          console.error(error);
          this.displayError(error as Error);
          this._rowDataSrc.next([]);
          this._showTableSrc.next(true);
          this._sessionService.setEnableControls(true);
          return of(undefined);
        })
      )
      .subscribe();
  }

  public constructor(
    private _addonProviderService: AddonProviderFactory,
    private _dialog: MatDialog,
    private _dialogFactory: DialogFactory,
    private _cdRef: ChangeDetectorRef,
    private _addonService: AddonService,
    private _sessionService: SessionService,
    private _wowUpService: WowUpService,
    private _translateService: TranslateService,
    private _snackbarService: SnackbarService,
    public electronService: ElectronService,
    public warcraftService: WarcraftService,
    public warcraftInstallationService: WarcraftInstallationService,
    public relativeDurationPipe: RelativeDurationPipe,
    public downloadCountPipe: DownloadCountPipe
  ) {
    this.overlayNoRowsTemplate = `<span class="text-1 mat-h1">${
      _translateService.instant("COMMON.SEARCH.NO_ADDONS") as string
    }</span>`;

    this.wowInstallations$ = warcraftInstallationService.wowInstallations$;

    _sessionService.selectedHomeTab$.pipe(takeUntil(this._destroy$)).subscribe((tabIndex) => {
      this._isSelectedTab = tabIndex === this.tabIndex;
      if (!this._isSelectedTab) {
        return;
      }

      this.setPageContextText(this._rowDataSrc.value.length);
      this.lazyLoad();
    });

    this.rowData$
      .pipe(
        takeUntil(this._destroy$),
        map((rowData) => this.setPageContextText(rowData.length))
      )
      .subscribe();

    this._addonService.searchError$.pipe(takeUntil(this._destroy$)).subscribe((error) => {
      this.displayError(error);
    });

    this.frameworkComponents = {
      potentialAddonRenderer: PotentialAddonTableCellComponent,
      statusRenderer: GetAddonStatusColumnComponent,
      contextHeader: TableContextHeaderCellComponent,
      wrapTextCell: CellWrapTextComponent,
    };

    this.columnDefs$.next(this.createColumns());

    this.addonCategories = this.buildCategories();
    this.selectedAddonCategory = this.addonCategories[0];
  }

  public resetCategory(silent = false): void {
    if (silent) {
      this._selectedAddonCategory = this.addonCategories[0];
    } else {
      this.selectedAddonCategory = this.addonCategories[0];
    }
  }

  private buildCategories() {
    const categoryKeys = getEnumKeys(AddonCategory).filter((key) => key.toLowerCase() !== "unknown");
    const categoryItems: CategoryItem[] = categoryKeys.map((key) => {
      return {
        category: AddonCategory[key],
        localeKey: `COMMON.ADDON_CATEGORIES.${camelToSnakeCase(key).toUpperCase()}`,
      };
    });

    // make sure all addons is always first
    const allAddonsCategory = _.remove(categoryItems, (item) => item.category === AddonCategory.AllAddons);
    categoryItems.unshift(allAddonsCategory[0]);

    return categoryItems;
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

  public onRowClicked(event: RowClickedEvent): void {
    const selectedNodes = event.api.getSelectedNodes();

    if (
      selectedNodes.length === 1 &&
      this._lastSelectionState.length === 1 &&
      event.node.data.externalId === this._lastSelectionState[0].data.externalId &&
      event.node.data.providerName === this._lastSelectionState[0].data.providerName
    ) {
      event.node.setSelected(false);
      this._lastSelectionState = [];
    } else {
      this._lastSelectionState = [...selectedNodes];
    }
  }

  public onRowDoubleClicked(evt: RowDoubleClickedEvent): void {
    const defaultChannel = this.defaultAddonChannel;
    if (defaultChannel === undefined) {
      return;
    }

    this.openDetailDialog(evt.data.searchResult as AddonSearchResult, this.defaultAddonChannel);
    evt.node.setSelected(true);
  }

  public onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    this.gridColumnApi = params.columnApi;
  }

  public ngOnInit(): void {
    this._wowUpService
      .getGetAddonsHiddenColumns()
      .then((columnStates) => {
        const colDefs = [...this.columnDefs$.value];
        this.columnStates.forEach((col) => {
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
      })
      .catch((e) => console.error(e));
  }

  public ngOnDestroy(): void {
    this._destroy$.next(true);
  }

  public onStatusColumnUpdated(): void {
    this._cdRef.detectChanges();
  }

  public onHeaderContext = (event: MouseEvent): void => {
    event.preventDefault();
    this.updateContextMenuPosition(event);
    this.columnContextMenu.menuData = {
      columns: this.columnStates.filter((col) => col.allowToggle),
    };
    this.columnContextMenu.menu.focusFirstItem("mouse");
    this.columnContextMenu.openMenu();
  };

  private updateContextMenuPosition(event: MouseEvent) {
    this.contextMenuPosition.x = `${event.clientX}px`;
    this.contextMenuPosition.y = `${event.clientY}px`;
  }

  public async onColumnVisibleChange(event: MatCheckboxChange, column: ColumnState): Promise<void> {
    const colState = this.columnStates.find((col) => col.name === column.name);
    if (!colState) {
      return;
    }

    colState.visible = event.checked;
    await this._wowUpService.setGetAddonsHiddenColumns([...this.columnStates]);

    this.gridColumnApi.setColumnVisible(column.name, event.checked);
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
        lineHeight: "62px",
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
        headerName: this._translateService.instant("PAGES.GET_ADDONS.TABLE.ADDON_COLUMN_HEADER"),
        sortable: true,
        cellRenderer: "potentialAddonRenderer",
        cellRendererParams: {
          channel: this.defaultAddonChannel,
          clientType: this.selectedClient,
        },
        valueGetter: (params) => {
          return params.data.canonicalName;
        },
        ...baseColumn,
      },
      {
        field: "downloadCount",
        flex: 1,
        sortable: true,
        headerName: this._translateService.instant("PAGES.GET_ADDONS.TABLE.DOWNLOAD_COUNT_COLUMN_HEADER"),
        valueFormatter: (row) => this.downloadCountPipe.transform(row.data.downloadCount as number),
        comparator: (va, vb, na, nb) => this.compareElement(na, nb, "downloadCount"),
        ...baseColumn,
      },
      {
        field: "releasedAt",
        flex: 1,
        sortable: true,
        headerName: this._translateService.instant("PAGES.GET_ADDONS.TABLE.RELEASED_AT_COLUMN_HEADER"),
        valueFormatter: (row) => this.relativeDurationPipe.transform(row.data.releasedAt as string),
        comparator: (va, vb, na, nb) => this.compareElement(na, nb, "releasedAt"),
        ...baseColumn,
      },
      {
        field: "author",
        flex: 1,
        sortable: true,
        headerName: this._translateService.instant("PAGES.GET_ADDONS.TABLE.AUTHOR_COLUMN_HEADER"),
        comparator: (va, vb, na, nb) => this.compareElement(na, nb, "author"),
        cellRenderer: "wrapTextCell",
        ...baseColumn,
      },
      {
        field: "providerName",
        flex: 1,
        sortable: true,
        headerName: this._translateService.instant("PAGES.GET_ADDONS.TABLE.PROVIDER_COLUMN_HEADER"),
        comparator: (va, vb, na, nb) => this.compareElement(na, nb, "providerName"),
        ...baseColumn,
      },
      {
        field: "status",
        flex: 1,
        headerName: this._translateService.instant("PAGES.GET_ADDONS.TABLE.STATUS_COLUMN_HEADER"),
        comparator: (va, vb, na, nb) => this.compareElement(na, nb, "status"),
        cellRenderer: "statusRenderer",
        ...baseColumn,
      },
    ];
  }

  private lazyLoad() {
    if (this._lazyLoaded) {
      return;
    }
    console.debug("GET ADDON LAZY LOAD");

    this._lazyLoaded = true;

    this._sessionService.selectedWowInstallation$.pipe(takeUntil(this._destroy$)).subscribe((installation) => {
      if (!installation) {
        return;
      }

      this.query = "";

      this.selectedInstallation = installation;
      this.selectedInstallationId = installation.id;
      this.loadPopularAddons(this.selectedInstallation);
    });

    this._addonService.addonRemoved$.pipe(takeUntil(this._destroy$)).subscribe(() => {
      this.onRefresh();
    });

    this._wowUpService.preferenceChange$
      .pipe(
        takeUntil(this._destroy$),
        filter((change) => change.key.indexOf(DEFAULT_CHANNEL_PREFERENCE_KEY_SUFFIX) !== -1)
      )
      .subscribe(() => {
        this.onSearch();
      });
  }

  public onInstallFromUrl(): void {
    const dialogRef = this._dialog.open(InstallFromUrlDialogComponent);
    dialogRef.afterClosed().subscribe(() => {
      console.log("The dialog was closed");
    });
  }

  public async onClientChange(): Promise<void> {
    await this._sessionService.setSelectedWowInstallation(this.selectedInstallationId);
  }

  public onRefresh(): void {
    if (!this.selectedInstallation) {
      return;
    }

    if (this.query) {
      this.onSearch();
    } else {
      this.loadPopularAddons(this.selectedInstallation);
    }
  }

  public onClearSearch(): void {
    this.query = "";
    this.onSearch();
  }

  public onSearch(): void {
    if (!this.selectedInstallation) {
      return;
    }

    this._sessionService.setEnableControls(false);
    this._showTableSrc.next(false);
    this.resetCategory(true);

    if (!this.query) {
      this.loadPopularAddons(this.selectedInstallation);
      return;
    }

    from(this._addonService.search(this.query, this.selectedInstallation))
      .pipe(
        first(),
        map((searchResults) => {
          const searchListItems = this.formatAddons(searchResults);
          this._rowDataSrc.next(searchListItems);
          this._showTableSrc.next(true);
          this._sessionService.setEnableControls(true);
        }),
        catchError((error) => {
          console.error(error);
          this.displayError(error as Error);
          this._rowDataSrc.next([]);
          this._showTableSrc.next(true);
          this._sessionService.setEnableControls(true);
          return of(undefined);
        })
      )
      .subscribe();
  }

  public onDoubleClickRow(listItem: GetAddonListItem): void {
    this.openDetailDialog(listItem.searchResult, this.defaultAddonChannel);
  }

  public onAddonColumnDetailDialog(event: PotentialAddonViewDetailsEvent): void {
    this.openDetailDialog(event.searchResult, event.channelType);
  }

  public openDetailDialog(searchResult: AddonSearchResult, channelType: AddonChannelType): void {
    this._dialogFactory.getPotentialAddonDetailsDialog(searchResult, channelType);
  }

  private loadPopularAddons(installation: WowInstallation) {
    if (!installation) {
      return;
    }

    if (this._addonProviderService.getEnabledAddonProviders().length === 0) {
      this._rowDataSrc.next([]);
      this._sessionService.setEnableControls(true);
      this._cdRef.detectChanges();
      return;
    }

    this._showTableSrc.next(false);
    this._sessionService.setEnableControls(false);

    this._addonService
      .getFeaturedAddons(installation)
      .pipe(
        catchError((error) => {
          console.error(`getFeaturedAddons failed`, error);
          return of([]);
        })
      )
      .subscribe((addons) => {
        const listItems = this.formatAddons(addons);
        this._rowDataSrc.next(listItems);
        this._showTableSrc.next(true);
        this._sessionService.setEnableControls(true);
      });
  }

  private formatAddons(addons: AddonSearchResult[]): GetAddonListItem[] {
    const mapped = addons.map((addon) => {
      try {
        return new GetAddonListItem(addon, this.defaultAddonChannel);
      } catch (e) {
        console.error("formatAddons", e);
        console.error(addon);
      }
    });

    const addonList: GetAddonListItem[] = [];
    for (const item of mapped) {
      if (item) {
        addonList.push(item);
      }
    }

    return this.sortAddons(addonList);
  }

  private sortAddons(addons: GetAddonListItem[]) {
    // If sorting by download count, push Hub addons to the top for exposure for now.
    return _.orderBy(
      addons,
      [
        (sr) => (sr.providerName === ADDON_PROVIDER_HUB ? 1 : 0),
        (sr) => (sr.providerName === ADDON_PROVIDER_WAGO ? 1 : 0),
        "downloadCount",
      ],
      ["desc", "desc", "desc"]
    );
  }

  private setPageContextText(rowCount: number) {
    const contextStr: string =
      rowCount > 0
        ? this._translateService.instant("PAGES.MY_ADDONS.PAGE_CONTEXT_FOOTER.SEARCH_RESULTS", { count: rowCount })
        : "";

    this._sessionService.setContextText(this.tabIndex, contextStr);
  }

  private displayError(error: Error) {
    if (error instanceof GenericProviderError) {
      this._snackbarService.showErrorSnackbar("COMMON.PROVIDER_ERROR", {
        localeArgs: {
          providerName: error.message,
        },
      });
    } else {
      this._snackbarService.showErrorSnackbar("PAGES.MY_ADDONS.ERROR_SNACKBAR");
    }
  }
}
