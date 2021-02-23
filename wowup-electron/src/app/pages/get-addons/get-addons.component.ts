import * as _ from "lodash";
import { BehaviorSubject, combineLatest, from, Observable, of, Subscription } from "rxjs";
import { catchError, filter, first, map } from "rxjs/operators";

import {
  AfterViewChecked,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import { MatCheckboxChange } from "@angular/material/checkbox";
import { MatDialog } from "@angular/material/dialog";
import { MatMenuTrigger } from "@angular/material/menu";
import { MatSort, Sort } from "@angular/material/sort";
import { MatTableDataSource } from "@angular/material/table";
import { TranslateService } from "@ngx-translate/core";

import { GetAddonListItem } from "../../business-objects/get-addon-list-item";
import { AddonDetailComponent, AddonDetailModel } from "../../components/addon-detail/addon-detail.component";
import { InstallFromUrlDialogComponent } from "../../components/install-from-url-dialog/install-from-url-dialog.component";
import { PotentialAddonViewDetailsEvent } from "../../components/potential-addon-table-column/potential-addon-table-column.component";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { AddonChannelType } from "../../models/wowup/addon-channel-type";
import { AddonSearchResult } from "../../models/wowup/addon-search-result";
import { ColumnState } from "../../models/wowup/column-state";
import { ElectronService } from "../../services";
import { AddonService } from "../../services/addons/addon.service";
import { SessionService } from "../../services/session/session.service";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { ADDON_PROVIDER_HUB } from "../../../common/constants";
import { SnackbarService } from "../../services/snackbar/snackbar.service";
import { GenericProviderError } from "../../errors";
import {
  CdkVirtualScrollViewport,
  FixedSizeVirtualScrollStrategy,
  VIRTUAL_SCROLL_STRATEGY,
} from "@angular/cdk/scrolling";
import { WowInstallation } from "app/models/wowup/wow-installation";
import { WarcraftInstallationService } from "app/services/warcraft/warcraft-installation.service";

const ROW_HEIGHT = 62;
const PAGESIZE = 20;

// This is a derivative of the following example but with a subject as a data source
// https://stackblitz.com/edit/cdk-virtual-table-sticky-header?file=src%2Fapp%2Fapp.component.ts
class AddonListItemDataSource extends MatTableDataSource<GetAddonListItem> {
  private readonly _offsetChangeSrc = new BehaviorSubject(0);

  // Keep track of the last start position to prevent re-calculation
  public currentStart = 0;

  // Current vertical offset in pixels
  public offset = 0;

  public lastTop = 0;

  public scrollElement: any = undefined;

  // Notify any listeners when the offset changes
  public offsetChange$ = this._offsetChangeSrc.asObservable();

  constructor(private subject: BehaviorSubject<GetAddonListItem[]>, private viewport: CdkVirtualScrollViewport) {
    super();

    subject.subscribe((data) => {
      this.viewport.setTotalContentSize(ROW_HEIGHT * data.length);
      this.handleNewData(0);
    });

    this.viewport.elementScrolled().subscribe((evt: any) => {
      this.scrollElement = evt.currentTarget;
      const start = Math.floor(evt.currentTarget.scrollTop / ROW_HEIGHT);
      if (start !== this.currentStart) {
        this.lastTop = evt.currentTarget.scrollTop;
        this.currentStart = start;
        this.handleNewData(start);
      }
    });
  }

  resume() {
    this.viewport.getElementRef().nativeElement.scrollTop = this.lastTop;
    this.viewport.getElementRef().nativeElement.dispatchEvent(new CustomEvent("scroll"));
  }

  handleNewData(start: number) {
    const end = start + PAGESIZE;
    const data = [...this.subject.value];
    const slicedData = _.slice(data, start, end);
    this.offset = ROW_HEIGHT * start;
    this.viewport.setRenderedContentOffset(this.offset);
    this._offsetChangeSrc.next(this.offset);
    // For some reason the first element is not shown
    this.data = [{ ..._.first(slicedData) }, ...slicedData];
  }
}

/**
 * Virtual Scroll Strategy
 */
export class CustomVirtualScrollStrategy extends FixedSizeVirtualScrollStrategy {
  constructor() {
    super(ROW_HEIGHT, 1000, 2000);
  }

  attach(viewport: CdkVirtualScrollViewport): void {
    this.onDataLengthChanged();
  }
}

@Component({
  selector: "app-get-addons",
  templateUrl: "./get-addons.component.html",
  styleUrls: ["./get-addons.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: VIRTUAL_SCROLL_STRATEGY, useClass: CustomVirtualScrollStrategy }],
})
export class GetAddonsComponent implements OnInit, AfterViewInit, OnDestroy, AfterViewChecked {
  @Input("tabIndex") tabIndex: number;

  @ViewChild(MatSort) sort: MatSort;
  @ViewChild("table", { read: ElementRef }) table: ElementRef;
  @ViewChild("columnContextMenuTrigger") columnContextMenu: MatMenuTrigger;
  @ViewChild("viewport") viewport: CdkVirtualScrollViewport;

  private _subscriptions: Subscription[] = [];
  private _isSelectedTab = false;
  private _lazyLoaded = false;
  private _automaticSort = false;
  private _dataSubject = new BehaviorSubject<GetAddonListItem[]>([]);
  private _isBusySubject = new BehaviorSubject<boolean>(true);
  private _resumeTable = false;

  public dataSource: AddonListItemDataSource;
  public activeSort = "downloadCount";
  public activeSortDirection = "desc";
  public placeholderHeight = 0;

  columns: ColumnState[] = [
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

  public get displayedColumns(): string[] {
    return this.columns.filter((col) => col.visible).map((col) => col.name);
  }

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

  public isBusy$ = this._isBusySubject.asObservable();
  public data$ = this._dataSubject.asObservable();
  public hasData$ = this.data$.pipe(map((data) => data.length > 0));
  public readonly showTable$ = combineLatest([this.isBusy$, this.hasData$]).pipe(
    map(([isBusy, hasData]) => {
      return isBusy === false && hasData === true;
    })
  );

  constructor(
    private _addonService: AddonService,
    private _sessionService: SessionService,
    private _dialog: MatDialog,
    private _wowUpService: WowUpService,
    private _cdRef: ChangeDetectorRef,
    private _translateService: TranslateService,
    private _snackbarService: SnackbarService,
    public electronService: ElectronService,
    public warcraftService: WarcraftService,
    public warcraftInstallationService: WarcraftInstallationService
  ) {
    this.wowInstallations$ = warcraftInstallationService.wowInstallations$;

    const sortOrder = this._wowUpService.getAddonsSortOrder;
    this.activeSort = sortOrder?.name ?? "";
    this.activeSortDirection = sortOrder?.direction ?? "";

    _sessionService.selectedHomeTab$.subscribe((tabIndex) => {
      this._isSelectedTab = tabIndex === this.tabIndex;
      if (!this._isSelectedTab) {
        return;
      }
      this.setPageContextText();
      this.lazyLoad();
    });
  }

  ngAfterViewChecked(): void {
    // Wait for the tab to have a height, then if we need to resume the table do so
    if (this._resumeTable && this.viewport.elementRef.nativeElement.scrollHeight > 0) {
      this._resumeTable = false;
      this.dataSource.resume();
    }
  }

  ngOnInit(): void {
    this._subscriptions.push(
      this._addonService.searchError$.subscribe((error) => {
        this.displayError(error);
      })
    );

    const columnStates = this._wowUpService.getAddonsHiddenColumns;
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

  ngOnDestroy(): void {
    this._subscriptions.forEach((sub) => sub.unsubscribe());
    this._subscriptions = [];
  }

  ngAfterViewInit(): void {
    this.dataSource = new AddonListItemDataSource(this._dataSubject, this.viewport);
    this.dataSource.offsetChange$.subscribe((offset) => {
      this.placeholderHeight = offset;
    });
  }

  placeholderWhen(index: number, _: any): boolean {
    return index == 0;
  }

  onSortChange(sort: Sort): void {
    const sortedData = this.sortAddons(this._dataSubject.value.slice(), sort);
    this._wowUpService.getAddonsSortOrder = {
      name: this.sort.active,
      direction: this.sort.direction,
    };

    this._dataSubject.next(sortedData);
  }

  onStatusColumnUpdated(): void {
    this._cdRef.detectChanges();
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

  private updateContextMenuPosition(event: MouseEvent) {
    this.contextMenuPosition.x = `${event.clientX}px`;
    this.contextMenuPosition.y = `${event.clientY}px`;
  }

  public onColumnVisibleChange(event: MatCheckboxChange, column: ColumnState): void {
    const col = this.columns.find((col) => col.name === column.name);
    col.visible = event.checked;
    this._wowUpService.getAddonsHiddenColumns = [...this.columns];
  }

  private lazyLoad() {
    if (this._lazyLoaded) {
      // Since we've already loaded the table before, mark that we want to resume scroll position
      this._resumeTable = true;
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

    const dataSourceSub = this.dataSource.connect().subscribe(() => {
      this.setPageContextText();
    });

    this._subscriptions = [selectedInstallationSub, addonRemovedSubscription, channelTypeSubscription, dataSourceSub];
  }

  onInstallFromUrl(): void {
    const dialogRef = this._dialog.open(InstallFromUrlDialogComponent);
    dialogRef.afterClosed().subscribe(() => {
      console.log("The dialog was closed");
    });
  }

  onClientChange(): void {
    this._sessionService.setSelectedWowInstallation(this.selectedInstallationId);
  }

  onRefresh(): void {
    this.loadPopularAddons(this.selectedInstallation);
  }

  onClearSearch(): void {
    this.query = "";
    this.onSearch();
  }

  onSearch(): void {
    this._isBusySubject.next(true);

    if (!this.query) {
      this.loadPopularAddons(this.selectedInstallation);
      return;
    }

    from(this._addonService.search(this.query, this.selectedInstallation))
      .pipe(
        first(),
        map((searchResults) => {
          const searchListItems = this.formatAddons(searchResults);
          this._dataSubject.next(searchListItems);
          this._isBusySubject.next(false);
        }),
        catchError((error) => {
          console.error(error);
          this.displayError(error);
          this._dataSubject.next([]);
          this._isBusySubject.next(false);
          return of(undefined);
        })
      )
      .subscribe();
  }

  onDoubleClickRow(listItem: GetAddonListItem): void {
    this.openDetailDialog(listItem.searchResult, this.defaultAddonChannel);
  }

  onAddonColumnDetailDialog(event: PotentialAddonViewDetailsEvent): void {
    this.openDetailDialog(event.searchResult, event.channelType);
  }

  openDetailDialog(searchResult: AddonSearchResult, channelType: AddonChannelType): void {
    const data: AddonDetailModel = {
      searchResult: searchResult,
      channelType: channelType,
    };

    const dialogRef = this._dialog.open(AddonDetailComponent, {
      data,
    });

    dialogRef.afterClosed().subscribe();
  }

  private loadPopularAddons(installation: WowInstallation) {
    if (!installation) {
      return;
    }

    if (this._addonService.getEnabledAddonProviders().length === 0) {
      this._dataSubject.next([]);
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
        this._dataSubject.next(listItems);
        this._isBusySubject.next(false);
      });
  }

  private formatAddons(addons: AddonSearchResult[]): GetAddonListItem[] {
    const addonList = addons.map((addon) => new GetAddonListItem(addon, this.defaultAddonChannel));
    return this.sortAddons(addonList);
  }

  private sortAddons(addons: GetAddonListItem[], sort?: Sort) {
    const direction = (sort?.direction as "asc" | "desc") ?? (this.activeSortDirection as "asc" | "desc");
    const active = sort?.active ?? this.activeSort;

    // If sorting by download count, push Hub addons to the top for exposure for now.
    if (active === "downloadCount") {
      return _.orderBy(addons, [(sr) => (sr.providerName === ADDON_PROVIDER_HUB ? 1 : 0), active], ["desc", direction]);
    }

    return _.orderBy(addons, [active], [direction]);
  }

  private setPageContextText() {
    const length = this._dataSubject.value.length;
    const contextStr =
      length > 0
        ? this._translateService.instant("PAGES.MY_ADDONS.PAGE_CONTEXT_FOOTER.SEARCH_RESULTS", { count: length })
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
