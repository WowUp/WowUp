import { Component, Input, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { AddonDetailComponent } from "app/components/addon-detail/addon-detail.component";
import { InstallFromUrlDialogComponent } from "app/components/install-from-url-dialog/install-from-url-dialog.component";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { AddonDetailModel } from "app/models/wowup/addon-detail.model";
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
import { AddonChannelType } from "app/models/wowup/addon-channel-type";
import { WowUpService } from "app/services/wowup/wowup.service";

@Component({
  selector: "app-get-addons",
  templateUrl: "./get-addons.component.html",
  styleUrls: ["./get-addons.component.scss"],
})
export class GetAddonsComponent implements OnInit, OnDestroy {
  @Input("tabIndex") tabIndex: number;

  @ViewChild(MatSort) sort: MatSort;

  private readonly _displayAddonsSrc = new BehaviorSubject<GetAddonListItem[]>(
    []
  );
  private readonly _destroyed$ = new Subject<void>();
  private subscriptions: Subscription[] = [];
  private isSelectedTab: boolean = false;
  private channelTypeKey: string = "";

  public dataSource = new MatTableDataSource<GetAddonListItem>([]);

  columns: ColumnState[] = [
    { name: "name", display: "Addon", visible: true },
    { name: "downloadCount", display: "Downloads", visible: true },
    { name: "author", display: "Author", visible: true },
    { name: "providerName", display: "Provider", visible: true },
    { name: "status", display: "Status", visible: true },
  ];

  public get displayedColumns(): string[] {
    return this.columns.filter((col) => col.visible).map((col) => col.name);
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
    public warcraftService: WarcraftService
  ) {
    _sessionService.selectedHomeTab$.subscribe((tabIndex) => {
      this.isSelectedTab = tabIndex === this.tabIndex;
      if (this.isSelectedTab) {
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

    const displayAddonSubscription = this._displayAddonsSrc.subscribe(
      (items: GetAddonListItem[]) => {
        this.dataSource.data = items;
        this.dataSource.sortingDataAccessor = _.get;
        this.dataSource.sort = this.sort;
      }
    );

    const channelTypeSubscription = this._wowUpService.preferenceChange$
      .pipe(filter((change) => change.key === this.channelTypeKey))
      .subscribe((change) => {
        this.onSearch();
      });

    this.subscriptions = [
      selectedClientSubscription,
      addonRemovedSubscription,
      displayAddonSubscription,
      channelTypeSubscription,
    ];
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
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

    this._displayAddonsSrc.next(
      this.formatAddons(this.filterInstalledAddons(searchResults))
    );
    this.isBusy = false;
    this.setPageContextText();
  }

  openDetailDialog(addon: AddonSearchResult) {
    const dialogRef = this._dialog.open(AddonDetailComponent, {
      data: addon,
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
        console.log('FEAT', addons)
        const listItems = this.formatAddons(this.filterInstalledAddons(addons));
        this._displayAddonsSrc.next(listItems);
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
    const contextStr = this._displayAddonsSrc.value?.length
      ? `${this._displayAddonsSrc.value.length} results`
      : "";

    this._sessionService.setContextText(this.tabIndex, contextStr);
  }
}
