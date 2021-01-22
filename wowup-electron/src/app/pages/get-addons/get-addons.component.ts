import * as _ from "lodash";
import { Subscription } from "rxjs";
import { filter, map } from "rxjs/operators";

import {
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
import { MatSort } from "@angular/material/sort";
import { MatTableDataSource } from "@angular/material/table";
import { TranslateService } from "@ngx-translate/core";

import { ADDON_PROVIDER_HUB } from "../../../common/constants";
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

@Component({
  selector: "app-get-addons",
  templateUrl: "./get-addons.component.html",
  styleUrls: ["./get-addons.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GetAddonsComponent implements OnInit, OnDestroy {
  @Input("tabIndex") tabIndex: number;

  @ViewChild(MatSort) sort: MatSort;
  @ViewChild("table", { read: ElementRef }) table: ElementRef;
  @ViewChild("columnContextMenuTrigger") columnContextMenu: MatMenuTrigger;

  private _subscriptions: Subscription[] = [];
  private _isSelectedTab: boolean = false;
  private _lazyLoaded: boolean = false;
  private _automaticSort: boolean = false;

  public dataSource = new MatTableDataSource<GetAddonListItem>([]);
  public activeSort = "downloadCount";
  public activeSortDirection = "desc";

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

  public get defaultAddonChannelKey() {
    return this._wowUpService.getClientDefaultAddonChannelKey(this._sessionService.getSelectedClientType());
  }

  public get defaultAddonChannel() {
    return this._wowUpService.getDefaultAddonChannel(this._sessionService.getSelectedClientType());
  }

  public query = "";
  public isBusy = true;
  public selectedClient = WowClientType.None;
  public contextMenuPosition = { x: "0px", y: "0px" };

  constructor(
    private _addonService: AddonService,
    private _sessionService: SessionService,
    private _dialog: MatDialog,
    private _wowUpService: WowUpService,
    private _cdRef: ChangeDetectorRef,
    private _translateService: TranslateService,
    public electronService: ElectronService,
    public warcraftService: WarcraftService
  ) {
    _sessionService.selectedHomeTab$.subscribe((tabIndex) => {
      this._isSelectedTab = tabIndex === this.tabIndex;
      if (!this._isSelectedTab) {
        return;
      }
      this.setPageContextText();
      this.lazyLoad();
    });
  }

  ngOnInit(): void {
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

  ngOnDestroy() {
    this._subscriptions.forEach((sub) => sub.unsubscribe());
    this._subscriptions = [];
  }

  onSortChange(): void {
    if (this._automaticSort) {
      return;
    }

    if (this.table) {
      this.table.nativeElement.scrollIntoView({ behavior: "smooth" });
    }

    this._wowUpService.getAddonsSortOrder = {
      name: this.sort.active,
      direction: this.sort.direction,
    };

    this.setDataSource(this.sortAddons(this.dataSource.data, this.sort.active, this.sort.direction));
  }

  onStatusColumnUpdated() {
    this._cdRef.detectChanges();
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

  private updateContextMenuPosition(event: MouseEvent) {
    this.contextMenuPosition.x = event.clientX + "px";
    this.contextMenuPosition.y = event.clientY + "px";
  }

  public onColumnVisibleChange(event: MatCheckboxChange, column: ColumnState) {
    const col = this.columns.find((col) => col.name === column.name);
    col.visible = event.checked;
    this._wowUpService.getAddonsHiddenColumns = [...this.columns];
  }

  private loadSortOrder = () => {
    const sortOrder = this._wowUpService.getAddonsSortOrder;
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

  private lazyLoad() {
    if (this._lazyLoaded) {
      return;
    }

    this._lazyLoaded = true;

    const selectedClientSubscription = this._sessionService.selectedClientType$
      .pipe(
        map((clientType) => {
          this.selectedClient = clientType;
          this.loadPopularAddons(this.selectedClient);
        })
      )
      .subscribe();
    const addonRemovedSubscription = this._addonService.addonRemoved$
      .pipe(
        map((event: string) => {
          this.onRefresh();
        })
      )
      .subscribe();

    const channelTypeSubscription = this._wowUpService.preferenceChange$
      .pipe(filter((change) => change.key === this.defaultAddonChannelKey))
      .subscribe((change) => {
        this.onSearch();
      });

    const dataSourceSub = this.dataSource.connect().subscribe((data) => {
      this.setPageContextText();
    });

    this._subscriptions = [
      selectedClientSubscription,
      addonRemovedSubscription,
      channelTypeSubscription,
      dataSourceSub,
    ];
  }

  private setDataSource(items: GetAddonListItem[]) {
    this.dataSource.data = items;
    // this.dataSource.sortingDataAccessor = (item: GetAddonListItem, prop: string) => {
    //   if (prop === "releasedAt") {
    //     return SearchResults.getLatestFile(item.searchResult, this.defaultAddonChannel)?.releaseDate;
    //   }
    //   let value = _.get(item, prop);
    //   console.debug(value);
    //   return typeof value === "string" ? value.toLowerCase() : value;
    // };
    // this.dataSource.sort = this.sort;
    this.loadSortOrder();
  }

  onInstallFromUrl() {
    const dialogRef = this._dialog.open(InstallFromUrlDialogComponent);
    dialogRef.afterClosed().subscribe((result) => {
      console.log("The dialog was closed");
    });
  }

  onClientChange() {
    this._sessionService.setSelectedClientType(this.selectedClient);
  }

  onRefresh() {
    this.loadPopularAddons(this.selectedClient);
  }

  onClearSearch() {
    this.query = "";
    this.onSearch();
  }

  async onSearch() {
    if (!this.query) {
      await this.loadPopularAddons(this.selectedClient);
      return;
    }

    this.isBusy = true;

    let searchResults = await this._addonService.search(this.query, this.selectedClient);

    this.setDataSource(this.formatAddons(searchResults));
    this.isBusy = false;
    this._cdRef.detectChanges();
  }

  onDoubleClickRow(listItem: GetAddonListItem) {
    this.openDetailDialog(listItem.searchResult, this.defaultAddonChannel);
  }

  onAddonColumnDetailDialog(event: PotentialAddonViewDetailsEvent) {
    this.openDetailDialog(event.searchResult, event.channelType);
  }

  openDetailDialog(searchResult: AddonSearchResult, channelType: AddonChannelType) {
    const data: AddonDetailModel = {
      searchResult: searchResult,
      channelType: channelType,
    };

    const dialogRef = this._dialog.open(AddonDetailComponent, {
      data,
    });

    dialogRef.afterClosed().subscribe();
  }

  private async loadPopularAddons(clientType: WowClientType) {
    if (clientType === WowClientType.None) {
      return;
    }

    if (this._addonService.getEnabledAddonProviders().length === 0) {
      this.setDataSource([]);
      this.isBusy = false;
      this._cdRef.detectChanges();
      return;
    }

    this.isBusy = true;

    this._addonService.getFeaturedAddons(clientType).subscribe({
      next: (addons) => {
        console.debug(addons);
        const listItems = this.formatAddons(addons);
        this.setDataSource(listItems);
        this.isBusy = false;
      },
      error: (err) => {
        console.error(err);
      },
    });
  }

  private formatAddons(addons: AddonSearchResult[]): GetAddonListItem[] {
    const addonList = addons.map((addon) => new GetAddonListItem(addon, this.defaultAddonChannel));
    return this.sortAddons(addonList);
  }

  private sortAddons(addons: GetAddonListItem[], sort?: string, dir?: string) {
    console.debug(sort || this.activeSort, dir || this.activeSortDirection);
    if (sort === "providerName") {
      return _.orderBy(addons, [sort || this.activeSort], [(dir || this.activeSortDirection) as any]);
    }

    return _.orderBy(
      addons,
      [(sr) => (sr.providerName === ADDON_PROVIDER_HUB ? 1 : 0), sort || this.activeSort],
      ["desc", (dir || this.activeSortDirection) as any]
    );
  }

  private setPageContextText() {
    const length = this.dataSource.data?.length;
    const contextStr = length
      ? this._translateService.instant("PAGES.MY_ADDONS.PAGE_CONTEXT_FOOTER.SEARCH_RESULTS", { count: length })
      : "";

    this._sessionService.setContextText(this.tabIndex, contextStr);
  }
}
