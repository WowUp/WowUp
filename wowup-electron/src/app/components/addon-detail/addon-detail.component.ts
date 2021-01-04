import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";
import { BehaviorSubject, from, of, Subscription } from "rxjs";
import { filter, first, switchMap, tap } from "rxjs/operators";
import { AddonChannelType } from "../../models/wowup/addon-channel-type";
import { AddonDependencyType } from "../../models/wowup/addon-dependency-type";
import { AddonSearchResultDependency } from "../../models/wowup/addon-search-result-dependency";
import * as SearchResult from "../../utils/search-result.utils";
import { AddonViewModel } from "../../business-objects/addon-view-model";
import { AddonSearchResult } from "../../models/wowup/addon-search-result";
import { AddonService } from "../../services/addons/addon.service";
import {
  ADDON_PROVIDER_GITHUB,
  ADDON_PROVIDER_HUB,
  ADDON_PROVIDER_TUKUI,
  ADDON_PROVIDER_UNKNOWN,
} from "../../../common/constants";
import { capitalizeString } from "../../utils/string.utils";
import { ElectronService } from "../../services";
import { SessionService } from "../../services/session/session.service";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatTabChangeEvent } from "@angular/material/tabs";

export interface AddonDetailModel {
  listItem?: AddonViewModel;
  searchResult?: AddonSearchResult;
  channelType?: AddonChannelType;
}

@Component({
  selector: "app-addon-detail",
  templateUrl: "./addon-detail.component.html",
  styleUrls: ["./addon-detail.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddonDetailComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild("descriptionContainer", { read: ElementRef }) descriptionContainer: ElementRef;
  @ViewChild("changelogContainer", { read: ElementRef }) changelogContainer: ElementRef;

  private readonly _subscriptions: Subscription[] = [];
  private readonly _dependencies: AddonSearchResultDependency[];
  private readonly _changelogSrc = new BehaviorSubject<string>("");
  private readonly _descriptionSrc = new BehaviorSubject<string>("");

  public readonly changelog$ = this._changelogSrc.asObservable();
  public readonly description$ = this._descriptionSrc.asObservable();
  public readonly capitalizeString = capitalizeString;
  public fetchingChangelog = true;
  public fetchingFullDescription = true;
  public selectedTabIndex = 0;

  constructor(
    @Inject(MAT_DIALOG_DATA) public model: AddonDetailModel,
    private _addonService: AddonService,
    private _translateService: TranslateService,
    private _cdRef: ChangeDetectorRef,
    private _electronService: ElectronService,
    private _snackBar: MatSnackBar,
    public sessionService: SessionService
  ) {
    this._dependencies = this.getDependencies();

    this._subscriptions.push(
      this._addonService.addonInstalled$
        .pipe(
          filter(
            (evt) =>
              evt.addon.id === this.model.listItem?.addon.id ||
              evt.addon.externalId === this.model.searchResult?.externalId
          )
        )
        .subscribe((evt) => {
          if (this.model.listItem) {
            this.model.listItem.addon = evt.addon;
            this.model.listItem.installState = evt.installState;
          }

          this._cdRef.detectChanges();
        })
    );

    const changelogSub = from(this.getChangelog())
      .pipe(tap(() => (this.fetchingChangelog = false)))
      .subscribe((changelog) => this._changelogSrc.next(changelog));

    const fullDescriptionSub = from(this.getFullDescription())
      .pipe(tap(() => (this.fetchingFullDescription = false)))
      .subscribe((description) => this._descriptionSrc.next(description));

    this._subscriptions.push(changelogSub, fullDescriptionSub);
  }

  ngOnInit(): void {
    this.selectedTabIndex = this.getSelectedTabTypeIndex(this.sessionService.getSelectedDetailsTab());
  }

  ngAfterViewChecked() {
    const descriptionContainer: HTMLDivElement = this.descriptionContainer?.nativeElement;
    const changelogContainer: HTMLDivElement = this.changelogContainer?.nativeElement;
    this.formatLinks(descriptionContainer);
    this.formatLinks(changelogContainer);
  }

  onSelectedTabChange(evt: MatTabChangeEvent) {
    this.sessionService.setSelectedDetailsTab(this.getSelectedTabTypeFromIndex(evt.index));
  }

  getSelectedTabTypeFromIndex(index: number): DetailsTabType {
    return index === 0 ? "description" : "changelog";
  }

  getSelectedTabTypeIndex(tabType: DetailsTabType): number {
    return tabType === "description" ? 0 : 1;
  }

  formatLinks(container: HTMLDivElement) {
    if (!container) {
      return;
    }

    const aTags = container.getElementsByTagName("a");
    for (let tag of Array.from(aTags)) {
      if (tag.getAttribute("clk")) {
        continue;
      }

      tag.setAttribute("clk", "1");
      tag.addEventListener("click", this.onOpenLink, false);
    }
  }

  ngOnDestroy(): void {
    this._subscriptions.forEach((sub) => sub.unsubscribe());
  }

  onClickExternalId() {
    this._translateService
      .get("DIALOGS.ADDON_DETAILS.COPY_ADDON_ID_SNACKBAR")
      .pipe(
        first(),
        tap((text) => {
          this._snackBar.open(text, undefined, {
            duration: 2000,
            panelClass: ["wowup-snackbar", "text-1"],
          });
        })
      )
      .subscribe();
  }

  onOpenLink = (e: MouseEvent) => {
    e.preventDefault();

    // Go up the call chain to find the tag
    const path = (e as any).path as HTMLElement[];
    let anchor: HTMLAnchorElement = undefined;
    for (let element of path) {
      if (element.tagName !== "A") {
        continue;
      }

      anchor = element as HTMLAnchorElement;
      break;
    }

    if (!anchor) {
      console.warn("No anchor in path");
      return false;
    }

    this._electronService.shell.openExternal(anchor.href);
    return false;
  };

  isUnknownProvider() {
    return this.model.listItem?.addon?.providerName === ADDON_PROVIDER_UNKNOWN;
  }

  isMissingUnknownDependencies() {
    return this.model.listItem?.addon?.missingDependencies.length;
  }

  getMissingDependencies() {
    return this.model.listItem?.addon?.missingDependencies ?? [];
  }

  hasChangelog() {
    return !!this.model.listItem?.addon?.latestChangelog;
  }

  getDescription() {
    return this.model.listItem?.addon?.summary || this.model.searchResult?.summary || "";
  }

  getChangelog = async () => {
    if (this.model.listItem) {
      return await this.getMyAddonChangelog();
    } else if (this.model.searchResult) {
      return await this.getSearchResultChangelog();
    }

    return "";
  };

  getFullDescription = async () => {
    const externalId = this.model.searchResult?.externalId ?? this.model.listItem?.addon?.externalId;
    const providerName = this.model.searchResult?.providerName ?? this.model.listItem?.addon?.providerName;

    if (providerName === ADDON_PROVIDER_GITHUB) {
      return this.model.listItem?.addon?.summary;
    }

    try {
      return await this._addonService.getFullDescription(
        this.sessionService.getSelectedClientType(),
        providerName,
        externalId
      );
    } catch (e) {
      return "";
    }
  };

  private async getSearchResultChangelog() {
    return await this._addonService.getChangelogForSearchResult(
      this.sessionService.getSelectedClientType(),
      this.model.channelType,
      this.model.searchResult
    );
  }

  private async getMyAddonChangelog() {
    return await this._addonService.getChangelogForAddon(
      this.sessionService.getSelectedClientType(),
      this.model.listItem?.addon
    );
  }

  get statusText() {
    if (!this.model.listItem) {
      return "";
    }

    if (this.model.listItem.isUpToDate()) {
      return this._translateService.instant("COMMON.ADDON_STATE.UPTODATE");
    }

    return "";
  }

  get showInstallButton() {
    return !!this.model.searchResult;
  }

  get showUpdateButton() {
    return this.model.listItem;
  }

  get title() {
    return this.model.listItem?.addon?.name || this.model.searchResult?.name || "UNKNOWN";
  }

  get subtitle() {
    return this.model.listItem?.addon?.author || this.model.searchResult?.author || "UNKNOWN";
  }

  get provider() {
    return this.model.listItem?.addon?.providerName || this.model.searchResult?.providerName || "UNKNOWN";
  }

  get summary() {
    return this.model.listItem?.addon?.summary || this.model.searchResult?.summary || "";
  }

  get externalUrl() {
    return this.model.listItem?.addon?.externalUrl || this.model.searchResult?.externalUrl || "UNKNOWN";
  }

  get defaultImageUrl(): string {
    if (this.model.listItem?.addon) {
      // if (this.model.listItem?.addon?.screenshotUrls?.length) {
      //   return this.model.listItem?.addon.screenshotUrls[0];
      // }
      return this.model.listItem?.addon.thumbnailUrl || "";
    }

    if (this.model.searchResult) {
      // if (this.model.searchResult?.screenshotUrls?.length) {
      //   return this.model.searchResult.screenshotUrls[0];
      // }
      return this.model.searchResult?.thumbnailUrl || "";
    }

    return "";
  }

  onInstallUpdated() {
    this._cdRef.detectChanges();
  }

  getDependencies() {
    if (this.model.searchResult) {
      return SearchResult.getDependencyType(
        this.model.searchResult,
        this.model.channelType,
        AddonDependencyType.Required
      );
    } else if (this.model.listItem) {
      return this.model.listItem.getDependencies(AddonDependencyType.Required);
    }

    return [];
  }

  hasRequiredDependencies() {
    return this._dependencies.length > 0;
  }

  getRequiredDependencyCount() {
    return this._dependencies.length;
  }

  getVersion() {
    return this.model.searchResult
      ? this.getLatestSearchResultFile().version
      : this.model.listItem.addon.installedVersion;
  }

  getFundingLinks() {
    return this.model.listItem?.addon?.fundingLinks;
  }

  hasFundingLinks() {
    return !!this.model.listItem?.addon?.fundingLinks?.length;
  }

  getExternalId() {
    return this.model.searchResult ? this.model.searchResult.externalId : this.model.listItem.addon.externalId;
  }

  private getLatestSearchResultFile() {
    return SearchResult.getLatestFile(this.model.searchResult, this.model.channelType);
  }
}
