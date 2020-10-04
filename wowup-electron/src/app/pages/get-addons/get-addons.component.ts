import { Component, OnDestroy, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { AddonDetailComponent } from "app/components/addon-detail/addon-detail.component";
import { InstallFromUrlDialogComponent } from "app/components/install-from-url-dialog/install-from-url-dialog.component";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { AddonDetailModel } from "app/models/wowup/addon-detail.model";
import { AddonUpdateEvent } from "app/models/wowup/addon-update-event";
import { ColumnState } from "app/models/wowup/column-state";
import { PotentialAddon } from "app/models/wowup/potential-addon";
import { ElectronService } from "app/services";
import { AddonService } from "app/services/addons/addon.service";
import { SessionService } from "app/services/session/session.service";
import { WarcraftService } from "app/services/warcraft/warcraft.service";
import { BehaviorSubject, Subscription } from "rxjs";
import { map, tap } from "rxjs/operators";

@Component({
  selector: "app-get-addons",
  templateUrl: "./get-addons.component.html",
  styleUrls: ["./get-addons.component.scss"],
})
export class GetAddonsComponent implements OnInit, OnDestroy {
  private readonly _displayAddonsSrc = new BehaviorSubject<PotentialAddon[]>(
    []
  );
  private subscriptions: Subscription[] = [];

  columns: ColumnState[] = [
    { name: "addon", display: "Addon", visible: true },
    { name: "author", display: "Author", visible: true },
    { name: "provider", display: "Provider", visible: true },
    { name: "status", display: "Status", visible: true },
  ];

  public get displayedColumns(): string[] {
    return this.columns.filter((col) => col.visible).map((col) => col.name);
  }

  public query = "";
  public displayAddons$ = this._displayAddonsSrc
    .asObservable()
    .pipe(tap((addons) => (this.displayedAddons = addons)));
  public isBusy = false;
  public selectedClient = WowClientType.None;

  displayedAddons: PotentialAddon[];

  constructor(
    private _addonService: AddonService,
    private _sessionService: SessionService,
    private _dialog: MatDialog,
    public electronService: ElectronService,
    public warcraftService: WarcraftService
  ) {}

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
    this.subscriptions = [selectedClientSubscription, addonRemovedSubscription];
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
    console.log(this.query);

    this.isBusy = true;

    let searchResults = await this._addonService.search(
      this.query,
      this.selectedClient
    );
    console.log(searchResults);
    searchResults = this.filterInstalledAddons(searchResults);
    this.formatAddons(searchResults);
    this._displayAddonsSrc.next(searchResults);
    this.isBusy = false;
  }

  openDetailDialog(addon: PotentialAddon) {
    const dialogRef = this._dialog.open(AddonDetailComponent, {
      data: new AddonDetailModel(addon),
    });
    dialogRef.afterClosed().subscribe((result) => {
      // this.onRefresh();
    });
  }

  private async loadPopularAddons(clientType: WowClientType) {
    if (clientType === WowClientType.None) {
      return;
    }

    this.isBusy = true;

    this._addonService.getFeaturedAddons(clientType).subscribe({
      next: (addons) => {
        // console.log('FEAT ADDONS', addons);
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
