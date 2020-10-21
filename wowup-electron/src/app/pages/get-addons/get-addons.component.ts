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
import { MatDialog } from "@angular/material/dialog";
import {
  AddonDetailComponent,
  AddonDetailModel,
} from "app/components/addon-detail/addon-detail.component";
import { InstallFromUrlDialogComponent } from "app/components/install-from-url-dialog/install-from-url-dialog.component";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { ColumnState } from "app/models/wowup/column-state";
import { ElectronService } from "app/services";
import { AddonService } from "app/services/addons/addon.service";
import { SessionService } from "app/services/session/session.service";
import { WarcraftService } from "app/services/warcraft/warcraft.service";
import { BehaviorSubject, Subject, Subscription } from "rxjs";
import { filter, map } from "rxjs/operators";
import { MatTableDataSource } from "@angular/material/table";
import { MatSort } from "@angular/material/sort";
import * as _ from "lodash";
import { GetAddonListItem } from "app/business-objects/get-addon-list-item";
import { AddonSearchResult } from "app/models/wowup/addon-search-result";
import { WowUpService } from "app/services/wowup/wowup.service";

@Component({
  selector: "app-get-addons",
  templateUrl: "./get-addons.component.html",
  styleUrls: ["./get-addons.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GetAddonsComponent implements OnInit, OnDestroy {
  @Input("tabIndex") tabIndex: number;

  @ViewChild(MatSort) sort: MatSort;

  private _subscriptions: Subscription[] = [];
  private _isSelectedTab: boolean = false;

  public dataSource = new MatTableDataSource<GetAddonListItem>([]);

  columns: ColumnState[] = [
    { name: "name", display: "Addon", visible: true },
    { name: "downloadCount", display: "Downloads", visible: true },
    { name: "releasedAt", display: "Released At", visible: true },
    { name: "author", display: "Author", visible: true },
    { name: "providerName", display: "Provider", visible: true },
    { name: "status", display: "Status", visible: true },
  ];

  public get displayedColumns(): string[] {
    return this.columns.filter((col) => col.visible).map((col) => col.name);
  }

  public get defaultAddonChannelKey() {
    return this._wowUpService.getClientDefaultAddonChannelKey(
      this._sessionService.selectedClientType
    );
  }

  public get defaultAddonChannel() {
    return this._wowUpService.getDefaultAddonChannel(
      this._sessionService.selectedClientType
    );
  }

  public query = "";
  public isBusy = false;
  public selectedClient = WowClientType.None;

  constructor(
    private _addonService: AddonService,
    private _sessionService: SessionService,
    private _dialog: MatDialog,
    private _wowUpService: WowUpService,
    public electronService: ElectronService,
    public warcraftService: WarcraftService,
    private _cdRef: ChangeDetectorRef
  ) {
    _sessionService.selectedHomeTab$.subscribe((tabIndex) => {
      this._isSelectedTab = tabIndex === this.tabIndex;
      if (this._isSelectedTab) {
        this.setPageContextText();
      }
    });
  }

  ngOnInit(): void {
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

    this._subscriptions = [
      selectedClientSubscription,
      addonRemovedSubscription,
      channelTypeSubscription,
    ];
  }

  ngOnDestroy() {
    this._subscriptions.forEach((sub) => sub.unsubscribe());
    this._subscriptions = [];
  }

  onStatusColumnUpdated() {
    this._cdRef.detectChanges();
  }

  private setDataSource(items: GetAddonListItem[]) {
    this.dataSource.data = items;
    this.dataSource.sortingDataAccessor = (
      item: GetAddonListItem,
      prop: string
    ) => {
      if (prop === "releasedAt") {
        return item.getLatestFile(this.defaultAddonChannel)?.releaseDate;
      }
      return _.get(item, prop);
    };
    this.dataSource.sort = this.sort;
  }

  onInstallFromUrl() {
    const dialogRef = this._dialog.open(InstallFromUrlDialogComponent);
    dialogRef.afterClosed().subscribe((result) => {
      console.log("The dialog was closed");
    });
  }

  onClientChange() {
    this._sessionService.selectedClientType = this.selectedClient;
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
      this.loadPopularAddons(this.selectedClient);
      this.setPageContextText();
      return;
    }

    this.isBusy = true;

    let searchResults = await this._addonService.search(
      this.query,
      this.selectedClient
    );

    this.setDataSource(
      this.formatAddons(this.filterInstalledAddons(searchResults))
    );
    this.isBusy = false;
    this.setPageContextText();
  }

  openDetailDialog(listItem: GetAddonListItem) {
    const data: AddonDetailModel = {
      searchResult: listItem.searchResult,
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

    this.isBusy = true;

    this._addonService.getFeaturedAddons(clientType).subscribe({
      next: (addons) => {
        const listItems = this.formatAddons(this.filterInstalledAddons(addons));
        this.setDataSource(listItems);
        this.isBusy = false;
      },
      error: (err) => {
        console.error(err);
      },
    });
  }

  private filterInstalledAddons(addons: AddonSearchResult[]) {
    return addons.filter(
      (addon) =>
        !this._addonService.isInstalled(
          addon.externalId,
          this._sessionService.selectedClientType
        )
    );
  }

  private formatAddons(addons: AddonSearchResult[]): GetAddonListItem[] {
    addons.forEach((addon) => {
      if (!addon.thumbnailUrl) {
        addon.thumbnailUrl = "assets/wowup_logo_512np.png";
      }
    });

    return addons.map((addon) => new GetAddonListItem(addon));
  }

  private setPageContextText() {
    const length = this.dataSource.data?.length;
    const contextStr = length ? `${length} results` : "";

    this._sessionService.setContextText(this.tabIndex, contextStr);
  }
}
