import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { AddonModel } from "app/business-objects/my-addons-list-item";
import { AddonDetailComponent } from "app/components/addon-detail/addon-detail.component";
import { InstallFromUrlDialogComponent } from "app/components/install-from-url-dialog/install-from-url-dialog.component";
import { Addon } from "app/entities/addon";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { AddonDetailModel } from "app/models/wowup/addon-detail.model";
import { AddonUpdateEvent } from "app/models/wowup/addon-update-event";
import { ColumnState } from "app/models/wowup/column-state";
import { PotentialAddon } from "app/models/wowup/potential-addon";
import { ElectronService } from "app/services";
import { AddonService } from "app/services/addons/addon.service";
import { SessionService } from "app/services/session/session.service";
import { WarcraftService } from "app/services/warcraft/warcraft.service";
import { BehaviorSubject, Subject, Subscription } from "rxjs";
import { map } from "rxjs/operators";
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import * as _ from 'lodash';

@Component({
  selector: "app-get-addons",
  templateUrl: "./get-addons.component.html",
  styleUrls: ["./get-addons.component.scss"],
})
export class GetAddonsComponent implements OnInit, OnDestroy {

  @ViewChild(MatSort) sort: MatSort;

  private readonly _displayAddonsSrc = new BehaviorSubject<PotentialAddon[]>([]);
  private readonly _destroyed$ = new Subject<void>();
  private subscriptions: Subscription[] = [];

  public dataSource = new MatTableDataSource<PotentialAddon>([]);

  columns: ColumnState[] = [
    { name: "name", display: "Addon", visible: true },
    { name: "status", display: "Status", visible: true },
    { name: "author", display: "Author", visible: true },
    { name: "provider", display: "Provider", visible: true },
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
    public electronService: ElectronService,
    public warcraftService: WarcraftService
  ) { }

  ngOnInit(): void {
    const selectedClientSubscription = this._sessionService.selectedClientType$.pipe(
      map((clientType) => {
        this.selectedClient = clientType;
        this.loadPopularAddons(this.selectedClient);
      })
    ).subscribe();

    const addonRemovedSubscription = this._addonService.addonRemoved$.pipe(
      map((event: string) => {
        this.onRefresh();
      })
    ).subscribe();

    const displayAddonSubscription = this._displayAddonsSrc
      .subscribe((items: PotentialAddon[]) => {
        this.dataSource.data = items;
        this.dataSource.sortingDataAccessor = _.get;
        this.dataSource.sort = this.sort;
      });

    this.subscriptions = [
      selectedClientSubscription,
      addonRemovedSubscription,
      displayAddonSubscription
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
      return;
    }

    this.isBusy = true;

    let searchResults = await this._addonService.search(
      this.query,
      this.selectedClient
    );

    searchResults = this.filterInstalledAddons(searchResults);
    this.formatAddons(searchResults);
    this._displayAddonsSrc.next(searchResults);
    this.isBusy = false;
  }

  openDetailDialog(addon: PotentialAddon) : void  {
    const dialogRef = this._dialog.open(AddonDetailComponent, {
      data:addon as Addon,
    });

    dialogRef.afterClosed().subscribe();
  }

  private loadPopularAddons(clientType: WowClientType) {
    if (clientType === WowClientType.None) {
      return;
    }

    this.isBusy = true;

    this._addonService.getFeaturedAddons(clientType).subscribe({
      next: (addons) => {
        addons = this.filterInstalledAddons(addons);
        this.formatAddons(addons);
        this._displayAddonsSrc.next(addons);
        this.isBusy = false;
      },
      error: (err) => {
        console.error(err);
      },
    });
  }

  private filterInstalledAddons(addons: PotentialAddon[]) {
    return addons.filter(
      (addon) =>
        !this._addonService.isInstalled(
          addon.externalId,
          this._sessionService.selectedClientType
        )
    );
  }

  private formatAddons(addons: PotentialAddon[]) {
    addons.forEach((addon) => {
      if (!addon.thumbnailUrl) {
        addon.thumbnailUrl = "assets/wowup_logo_512np.png";
      }
    });
  }
}
