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
import { BehaviorSubject, combineLatest, from, Observable, of, Subscription } from "rxjs";
import { catchError, delay, filter, first, map, switchMap } from "rxjs/operators";

import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { MatCheckboxChange } from "@angular/material/checkbox";
import { MatDialog } from "@angular/material/dialog";
import { MatMenuTrigger } from "@angular/material/menu";
import { MatDrawer } from "@angular/material/sidenav";
import { TranslateService } from "@ngx-translate/core";

import { ADDON_PROVIDER_HUB } from "../../../common/constants";
import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { AddonCategory, AddonChannelType } from "../../../common/wowup/models";
import { GetAddonListItem } from "../../business-objects/get-addon-list-item";
import { GetAddonStatusColumnComponent } from "../../components/get-addon-status-column/get-addon-status-column.component";
import { InstallFromUrlDialogComponent } from "../../components/install-from-url-dialog/install-from-url-dialog.component";
import {
  PotentialAddonTableColumnComponent,
  PotentialAddonViewDetailsEvent,
} from "../../components/potential-addon-table-column/potential-addon-table-column.component";
import { TableContextHeaderCellComponent } from "../../components/table-context-header-cell/table-context-header-cell.component";
import { GenericProviderError } from "../../errors";
import { AddonSearchResult } from "../../models/wowup/addon-search-result";
import { ColumnState } from "../../models/wowup/column-state";
import { WowInstallation } from "../../models/wowup/wow-installation";
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
  @Input("tabIndex") public tabIndex: number;

  @ViewChild("columnContextMenuTrigger") public columnContextMenu: MatMenuTrigger;
  @ViewChild("drawer") public drawer: MatDrawer;

  private _subscriptions: Subscription[] = [];
  private _isSelectedTab = false;
  private _lazyLoaded = false;
  private _isBusySubject = new BehaviorSubject<boolean>(true);
  private _rowDataSrc = new BehaviorSubject<GetAddonListItem[]>([]);
  private _lastSelectionState: RowNode[] = [];
  private _selectedAddonCategory: CategoryItem;

  public addonCategory = AddonCategory;
  public columnDefs: ColDef[] = [];
  public rowData$ = this._rowDataSrc.asObservable();
  public frameworkComponents = {};
  public columnTypes: {
    [key: string]: ColDef;
  } = {
    nonEditableColumn: { editable: false },
  };

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

  public get defaultAddonChannelKey(): string {
    return "";
    // return this._wowUpService.getClientDefaultAddonChannelKey(this._sessionService.getSelectedWowInstallation());
  }

  public get defaultAddonChannel(): AddonChannelType {
    return AddonChannelType.Stable;
    // return this._wowUpService.getDefaultAddonChannel(this._sessionService.getSelectedClientType());
  }

  public query = "";
  public selectedClient = WowClientType.None;
  public selectedInstallation: WowInstallation = undefined;
  public selectedInstallationId = "";
  public contextMenuPosition = { x: "0px", y: "0px" };
  public wowInstallations$: Observable<WowInstallation[]>;
  public overlayNoRowsTemplate = "";

  public isBusy$ = this._isBusySubject.asObservable();
  public hasData$ = this.rowData$.pipe(map((data) => data.length > 0));

  public readonly showTable$ = combineLatest([this.isBusy$, this.hasData$]).pipe(
    map(([isBusy, hasData]) => {
      return isBusy === false;
    })
  );

  public gridApi: GridApi;
  public gridColumnApi: ColumnApi;

  public addonCategories: CategoryItem[] = [];

  public get selectedAddonCategory(): CategoryItem {
    return this._selectedAddonCategory;
  }

  public set selectedAddonCategory(categoryItem: CategoryItem) {
    this._selectedAddonCategory = categoryItem;
    this.drawer?.close().catch((e) => console.error(e));

    if (categoryItem.category === AddonCategory.AllAddons) {
      this.loadPopularAddons(this.selectedInstallation);
      return;
    }

    of(true)
      .pipe(
        first(),
        map(() => {
          this._isBusySubject.next(true);
        }),
        switchMap(() => from(this._addonService.getCategoryPage(categoryItem.category, this.selectedInstallation))),
        map((searchResults) => {
          const searchListItems = this.formatAddons(searchResults);
          this._rowDataSrc.next(searchListItems);
          this._isBusySubject.next(false);
        }),
        catchError((error) => {
          console.error(error);
          this.displayError(error);
          this._rowDataSrc.next([]);
          this._isBusySubject.next(false);
          return of(undefined);
        })
      )
      .subscribe();
  }

  public constructor(
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

    const homeTabSub = _sessionService.selectedHomeTab$.subscribe((tabIndex) => {
      this._isSelectedTab = tabIndex === this.tabIndex;
      if (!this._isSelectedTab) {
        return;
      }

      this.setPageContextText(this._rowDataSrc.value.length);
      this.lazyLoad();
    });

    const rowDataSub = this.rowData$.pipe(map((rowData) => this.setPageContextText(rowData.length))).subscribe();

    this._subscriptions.push(
      homeTabSub,
      rowDataSub,
      this._addonService.searchError$.subscribe((error) => {
        this.displayError(error);
      })
    );

    this.frameworkComponents = {
      potentialAddonRenderer: PotentialAddonTableColumnComponent,
      statusRenderer: GetAddonStatusColumnComponent,
      contextHeader: TableContextHeaderCellComponent,
    };

    this.columnDefs = this.createColumns();

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
    const categoryKeys = getEnumKeys(AddonCategory);
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
    this.openDetailDialog(evt.data.searchResult, this.defaultAddonChannel);
    evt.node.setSelected(true);
  }

  public onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    this.gridColumnApi = params.columnApi;
  }

  public ngOnInit(): void {
    const columnStates = this._wowUpService.getGetAddonsHiddenColumns();
    this.columnStates.forEach((col) => {
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
  }

  public ngOnDestroy(): void {
    this._subscriptions.forEach((sub) => sub.unsubscribe());
    this._subscriptions = [];
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

  public onColumnVisibleChange(event: MatCheckboxChange, column: ColumnState): void {
    const colState = this.columnStates.find((col) => col.name === column.name);
    colState.visible = event.checked;
    this._wowUpService.setGetAddonsHiddenColumns([...this.columnStates]);

    this.gridColumnApi.setColumnVisible(column.name, event.checked);
  }

  private createColumns(): ColDef[] {
    const baseColumn = {
      headerComponent: "contextHeader",
      headerComponentParams: {
        onHeaderContext: this.onHeaderContext,
      },
      cellStyle: {
        lineHeight: "62px",
      },
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
        ...baseColumn,
      },
      {
        field: "downloadCount",
        flex: 1,
        sortable: true,
        headerName: this._translateService.instant("PAGES.GET_ADDONS.TABLE.DOWNLOAD_COUNT_COLUMN_HEADER"),
        valueFormatter: (row) => this.downloadCountPipe.transform(row.data.downloadCount),
        ...baseColumn,
      },
      {
        field: "releasedAt",
        flex: 1,
        sortable: true,
        headerName: this._translateService.instant("PAGES.GET_ADDONS.TABLE.RELEASED_AT_COLUMN_HEADER"),
        valueFormatter: (row) => this.relativeDurationPipe.transform(row.data.releasedAt),
        ...baseColumn,
      },
      {
        field: "author",
        flex: 1,
        sortable: true,
        headerName: this._translateService.instant("PAGES.GET_ADDONS.TABLE.AUTHOR_COLUMN_HEADER"),
        ...baseColumn,
      },
      {
        field: "providerName",
        flex: 1,
        sortable: true,
        headerName: this._translateService.instant("PAGES.GET_ADDONS.TABLE.PROVIDER_COLUMN_HEADER"),
        ...baseColumn,
      },
      {
        field: "status",
        flex: 1,
        headerName: this._translateService.instant("PAGES.GET_ADDONS.TABLE.STATUS_COLUMN_HEADER"),
        cellRenderer: "statusRenderer",
        ...baseColumn,
      },
    ];
  }

  private lazyLoad() {
    if (this._lazyLoaded) {
      return;
    }

    this._lazyLoaded = true;

    const selectedInstallationSub = this._sessionService.selectedWowInstallation$.subscribe((installation) => {
      this.selectedInstallation = installation;
      this.selectedInstallationId = installation.id;
      this.loadPopularAddons(this.selectedInstallation);
    });

    const addonRemovedSubscription = this._addonService.addonRemoved$.subscribe(() => {
      this.onRefresh();
    });

    const channelTypeSubscription = this._wowUpService.preferenceChange$
      .pipe(filter((change) => change.key === this.defaultAddonChannelKey))
      .subscribe(() => {
        this.onSearch();
      });

    this._subscriptions.push(selectedInstallationSub, addonRemovedSubscription, channelTypeSubscription);
  }

  public onInstallFromUrl(): void {
    const dialogRef = this._dialog.open(InstallFromUrlDialogComponent);
    dialogRef.afterClosed().subscribe(() => {
      console.log("The dialog was closed");
    });
  }

  public onClientChange(): void {
    this._sessionService.setSelectedWowInstallation(this.selectedInstallationId);
  }

  public onRefresh(): void {
    this.loadPopularAddons(this.selectedInstallation);
  }

  public onClearSearch(): void {
    this.query = "";
    this.onSearch();
  }

  public onSearch(): void {
    this._isBusySubject.next(true);
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
          this._isBusySubject.next(false);
        }),
        catchError((error) => {
          console.error(error);
          this.displayError(error);
          this._rowDataSrc.next([]);
          this._isBusySubject.next(false);
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

    if (this._addonService.getEnabledAddonProviders().length === 0) {
      this._rowDataSrc.next([]);
      this._isBusySubject.next(false);
      this._cdRef.detectChanges();
      return;
    }

    this._isBusySubject.next(true);

    this._addonService
      .getFeaturedAddons(installation)
      .pipe(
        catchError((error) => {
          console.error(`getFeaturedAddons failed`, error);
          return of([]);
        })
      )
      .subscribe((addons) => {
        console.debug(`Loaded ${addons?.length ?? 0} addons`);
        const listItems = this.formatAddons(addons);
        this._rowDataSrc.next(listItems);
        this._isBusySubject.next(false);
      });
  }

  private formatAddons(addons: AddonSearchResult[]): GetAddonListItem[] {
    const addonList = addons.map((addon) => new GetAddonListItem(addon, this.defaultAddonChannel));
    return this.sortAddons(addonList);
  }

  private sortAddons(addons: GetAddonListItem[]) {
    // If sorting by download count, push Hub addons to the top for exposure for now.
    return _.orderBy(
      addons,
      [(sr) => (sr.providerName === ADDON_PROVIDER_HUB ? 1 : 0), "downloadCount"],
      ["desc", "desc"]
    );
  }

  private setPageContextText(rowCount: number) {
    const contextStr =
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
