import { last } from "lodash";
import { Gallery, GalleryItem, ImageItem } from "ng-gallery";
import { BehaviorSubject, from, Observable, of, Subject } from "rxjs";
import { catchError, filter, first, map, takeUntil, tap } from "rxjs/operators";

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewChildren,
} from "@angular/core";
import {
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogRef as MatDialogRef,
} from "@angular/material/legacy-dialog";
import {
  MatLegacyTabChangeEvent as MatTabChangeEvent,
  MatLegacyTabGroup as MatTabGroup,
} from "@angular/material/legacy-tabs";
import { TranslateService } from "@ngx-translate/core";

import { ADDON_PROVIDER_GITHUB, ADDON_PROVIDER_UNKNOWN, TAB_INDEX_MY_ADDONS } from "../../../../common/constants";
import { AddonViewModel } from "../../../business-objects/addon-view-model";
import { AddonUpdateEvent } from "../../../models/wowup/addon-update-event";
import { AddonService } from "../../../services/addons/addon.service";
import { LinkService } from "../../../services/links/link.service";
import { SessionService } from "../../../services/session/session.service";
import { SnackbarService } from "../../../services/snackbar/snackbar.service";
import { formatDynamicLinks } from "../../../utils/dom.utils";
import * as SearchResult from "../../../utils/search-result.utils";
import { AddonUiService } from "../../../services/addons/addon-ui.service";
import { AddonProviderFactory } from "../../../services/addons/addon.provider.factory";
import { WowUpService } from "../../../services/wowup/wowup.service";
import {
  Addon,
  AddonChannelType,
  AddonDependency,
  AddonDependencyType,
  AddonFundingLink,
  AddonSearchResult,
  AddonSearchResultDependency,
} from "wowup-lib-core";
import { QueryList } from "@angular/core";

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
export class AddonDetailComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChildren("descriptionContainer", { read: ElementRef }) public descriptionContainer!: QueryList<ElementRef>;
  @ViewChildren("changelogContainer", { read: ElementRef }) public changelogContainer!: QueryList<ElementRef>;
  @ViewChild("providerLink", { read: ElementRef }) public providerLink!: ElementRef;
  @ViewChild("tabs", { static: false }) public tabGroup!: MatTabGroup;

  private readonly _dependencies: AddonSearchResultDependency[];
  private readonly _changelogSrc = new BehaviorSubject<string>("");
  private readonly _descriptionSrc = new BehaviorSubject<string>("");
  private readonly _destroy$ = new Subject<boolean>();

  public readonly changelog$ = this._changelogSrc.asObservable();
  public readonly description$ = this._descriptionSrc.asObservable();
  public fetchingChangelog = true;
  public fetchingFullDescription = true;
  public selectedTabIndex;
  public requiredDependencyCount = 0;
  public canShowChangelog = true;
  public hasIconUrl = false;
  public thumbnailLetter = "";
  public hasChangeLog = false;
  public showInstallButton = false;
  public showUpdateButton = false;
  public showRemoveButton = false;
  public hasRequiredDependencies = false;
  public title = "";
  public subtitle = "";
  public provider = "";
  public summary = "";
  public externalUrl = "";
  public defaultImageUrl = "";
  public version = "";
  public fundingLinks: AddonFundingLink[] = [];
  public hasFundingLinks = false;
  public fullExternalId = "";
  public externalId = "";
  public displayExternalId = "";
  public isUnknownProvider = false;
  public isMissingUnknownDependencies = false;
  public missingDependencies: string[] = [];
  public previewItems: GalleryItem[] = [];

  public constructor(
    @Inject(MAT_DIALOG_DATA) public model: AddonDetailModel,
    private _dialogRef: MatDialogRef<AddonDetailComponent>,
    private _addonService: AddonService,
    private _addonProviderService: AddonProviderFactory,
    private _cdRef: ChangeDetectorRef,
    private _snackbarService: SnackbarService,
    private _translateService: TranslateService,
    private _sessionService: SessionService,
    private _linkService: LinkService,
    private _addonUiService: AddonUiService,
    private _wowupService: WowUpService,
    public gallery: Gallery
  ) {
    this._dependencies = this.getDependencies();

    this._addonService.addonInstalled$
      .pipe(takeUntil(this._destroy$), filter(this.isSameAddon))
      .subscribe(this.onAddonInstalledUpdate);
  }

  public ngOnInit(): void {
    console.log("model", this.model);

    this.canShowChangelog = this._addonProviderService.canShowChangelog(this.getProviderName());

    this.thumbnailLetter = this.getThumbnailLetter();

    this.showInstallButton = !!this.model.searchResult;

    this.showUpdateButton = !!this.model.listItem;

    this.isAddonInstalled()
      .then((isInstalled) => (this.showRemoveButton = isInstalled))
      .catch((e) => console.error(e));

    this.title = this.model.listItem?.addon?.name || this.model.searchResult?.name || "UNKNOWN";

    this.subtitle = this.model.listItem?.addon?.author || this.model.searchResult?.author || "UNKNOWN";

    this.provider = this.model.listItem?.addon?.providerName || this.model.searchResult?.providerName || "UNKNOWN";

    this.summary = this.model.listItem?.addon?.summary || this.model.searchResult?.summary || "";

    this.externalUrl = this.model.listItem?.addon?.externalUrl || this.model.searchResult?.externalUrl || "UNKNOWN";

    this.defaultImageUrl = this.model.listItem?.addon?.thumbnailUrl || this.model.searchResult?.thumbnailUrl || "";

    this.hasIconUrl = !!this.defaultImageUrl;

    this.hasRequiredDependencies = this._dependencies.length > 0;

    this.requiredDependencyCount = this._dependencies.length;

    this.version =
      (this.model.searchResult
        ? this.getLatestSearchResultFile()?.version
        : this.model.listItem?.addon?.installedVersion) ?? "";

    this.fundingLinks = this.model.listItem?.addon?.fundingLinks ?? [];

    this.hasFundingLinks = !!this.model.listItem?.addon?.fundingLinks?.length;

    this.fullExternalId =
      (this.model.searchResult ? this.model.searchResult?.externalId : this.model.listItem?.addon?.externalId) ?? "";

    this.displayExternalId = this.getDisplayExternalId(this.fullExternalId);

    this.isUnknownProvider = this.model.listItem?.addon?.providerName === ADDON_PROVIDER_UNKNOWN;

    this.missingDependencies = this.model.listItem?.addon?.missingDependencies ?? [];

    this.isMissingUnknownDependencies = !!this.missingDependencies.length;

    const imageUrlList = this.model.listItem?.addon?.screenshotUrls ?? this.model.searchResult?.screenshotUrls ?? [];

    this.previewItems = imageUrlList.map((url) => {
      return new ImageItem({ src: url, thumb: url });
    });

    this.gallery.ref().load(this.previewItems);

    this.selectInitialTab().subscribe();
  }

  public ngAfterViewInit(): void {
    from(this.getChangelog())
      .pipe(
        first(),
        takeUntil(this._destroy$),
        tap(() => {
          this.fetchingChangelog = false;
        })
      )
      .subscribe((changelog) => {
        this.hasChangeLog = changelog.length > 0;
        this._changelogSrc.next(changelog);
      });

    from(this.getFullDescription())
      .pipe(
        takeUntil(this._destroy$),
        tap(() => {
          this.fetchingFullDescription = false;
        })
      )
      .subscribe((description) => {
        this._descriptionSrc.next(description);
      });

    this.changelogContainer.changes.pipe(takeUntil(this._destroy$)).subscribe(() => {
      formatDynamicLinks(this.changelogContainer.first.nativeElement as HTMLElement, this.onOpenLink);
    });
  }

  public ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
    window.getSelection()?.empty();
  }

  public projectContentChanged(muts: MutationRecord[]) {
    for (const mut of muts) {
      formatDynamicLinks(mut.target as HTMLDivElement, this.onOpenLink);
    }
  }

  public onInstallUpdated(): void {
    this._cdRef.detectChanges();
  }

  public async onSelectedTabChange(evt: MatTabChangeEvent): Promise<void> {
    await this._sessionService.setSelectedDetailsTab(this.getSelectedTabTypeFromIndex(evt.index));
  }

  public onClickExternalId(): void {
    this._snackbarService.showSuccessSnackbar("DIALOGS.ADDON_DETAILS.COPY_ADDON_ID_SNACKBAR", {
      timeout: 2000,
    });
  }

  public async onClickRemoveAddon(): Promise<void> {
    let addon: Addon | null = null;

    // Addon is expected to be available through the model when browsing My Addons tab
    if (this._sessionService.getSelectedHomeTab() === TAB_INDEX_MY_ADDONS) {
      if (typeof this.model.listItem?.addon?.name !== "string" || this.model.listItem.addon.name.length === 0) {
        console.warn("Invalid model list item addon");
        return;
      }

      addon = this.model.listItem?.addon;
    } else {
      const selectedInstallation = this._sessionService.getSelectedWowInstallation();
      const externalId = this.model.searchResult?.externalId ?? "";
      const providerName = this.model.searchResult?.providerName ?? "";

      if (!externalId || !providerName || !selectedInstallation) {
        console.warn("Invalid search result when identifying which addon to remove", {
          selectedInstallation,
          externalId,
          providerName,
        });
        return;
      }

      addon = await this._addonService.getByExternalId(externalId, providerName, selectedInstallation.id);
    }

    if (!addon) {
      console.warn("Invalid addon when attempting removal");
      return;
    }

    this._addonUiService
      .handleRemoveAddon(addon)
      .pipe(
        takeUntil(this._destroy$),
        first(),
        map((result) => {
          if (result.removed) {
            this._dialogRef.close();
          }
        })
      )
      .subscribe();
  }

  private getSelectedTabTypeFromIndex(index: number): DetailsTabType {
    switch (index) {
      case 0:
        return "description";
      case 1:
        return "changelog";
      case 2:
        return "previews";
      default:
        return "description";
    }
  }

  private getSelectedTabTypeIndex(tabType: DetailsTabType): number {
    switch (tabType) {
      case "description":
        return 0;
      case "changelog":
        return 1;
      case "previews":
        return this.previewItems.length === 0 ? 0 : 2;
      default:
        return 0;
    }
  }

  private getThumbnailLetter(): string {
    return this.model?.listItem?.thumbnailLetter ?? this.model.searchResult?.name?.charAt(0).toUpperCase() ?? "";
  }

  private getProviderName(): string {
    return this.model.listItem?.addon?.providerName ?? this.model.searchResult?.providerName ?? "";
  }

  private onAddonInstalledUpdate = (evt: AddonUpdateEvent): void => {
    if (this.model.listItem) {
      this.model.listItem.addon = evt.addon;
      this.model.listItem.installState = evt.installState;
    }

    this._cdRef.detectChanges();
  };

  private isSameAddon = (evt: AddonUpdateEvent): boolean => {
    return (
      evt.addon.id === this.model.listItem?.addon?.id || evt.addon.externalId === this.model.searchResult?.externalId
    );
  };

  private onOpenLink = (element: HTMLAnchorElement): boolean => {
    this.confirmLinkNavigation(element.href);

    return false;
  };

  private confirmLinkNavigation(href: string) {
    this._linkService.confirmLinkNavigation(href).subscribe();
  }

  private getChangelog = (): Promise<string> => {
    if (this.model.listItem) {
      return this.getMyAddonChangelog();
    } else if (this.model.searchResult) {
      return this.getSearchResultChangelog();
    }

    return Promise.resolve("");
  };

  private getFullDescription = async (): Promise<string> => {
    const externalId = this.model.searchResult?.externalId ?? this.model.listItem?.addon?.externalId ?? "";
    const providerName = this.model.searchResult?.providerName ?? this.model.listItem?.addon?.providerName ?? "";

    try {
      if (providerName === ADDON_PROVIDER_GITHUB) {
        if (this.model.listItem?.addon?.summary) {
          return this.model.listItem?.addon?.summary;
        }

        throw new Error("Invalid model list item addon");
      }

      const selectedInstallation = this._sessionService.getSelectedWowInstallation();
      if (!selectedInstallation) {
        throw new Error("No selected installation");
      }

      const description = await this._addonService.getFullDescription(
        selectedInstallation,
        providerName,
        externalId,
        this.model?.listItem?.addon
      );

      return description || this._translateService.instant("DIALOGS.ADDON_DETAILS.DESCRIPTION_NOT_FOUND");
    } catch (e) {
      return "";
    }
  };

  private getDependencies(): AddonDependency[] {
    if (this.model.searchResult) {
      return SearchResult.getDependencyType(
        this.model.searchResult,
        this.model.channelType ?? AddonChannelType.Stable,
        AddonDependencyType.Required
      );
    } else if (this.model.listItem) {
      return this.model.listItem.getDependencies(AddonDependencyType.Required);
    }

    return [];
  }

  private async getSearchResultChangelog() {
    const selectedInstallation = this._sessionService.getSelectedWowInstallation();
    if (!selectedInstallation) {
      console.warn("No selected installation");
      return "";
    }
    if (!this.model.searchResult) {
      console.warn("Invalid model searchResult");
      return "";
    }

    return await this._addonService.getChangelogForSearchResult(
      selectedInstallation,
      this.model.channelType ?? AddonChannelType.Stable,
      this.model.searchResult
    );
  }

  private async getMyAddonChangelog() {
    const selectedInstallation = this._sessionService.getSelectedWowInstallation();
    if (!selectedInstallation) {
      console.warn("No selected installation");
      return "";
    }

    if (!this.model.listItem?.addon) {
      console.warn("Invalid list item addon");
      return "";
    }

    return await this._addonService.getChangelogForAddon(selectedInstallation, this.model.listItem.addon);
  }

  private getDisplayExternalId(externalId: string): string {
    if (externalId.indexOf("/") !== -1) {
      return `...${last(externalId.split("/")) ?? ""}`;
    }

    return externalId;
  }

  private getLatestSearchResultFile() {
    return SearchResult.getLatestFile(this.model.searchResult, this.model.channelType ?? AddonChannelType.Stable);
  }

  private async isAddonInstalled(): Promise<boolean> {
    const selectedInstallation = this._sessionService.getSelectedWowInstallation();
    if (!selectedInstallation) {
      console.warn("No selected installation");
      return false;
    }

    const externalId = this.model.searchResult?.externalId ?? this.model.listItem?.addon?.externalId ?? "";
    const providerName = this.model.searchResult?.providerName ?? this.model.listItem?.addon?.providerName ?? "";

    if (externalId && providerName) {
      return await this._addonService.isInstalled(externalId, providerName, selectedInstallation);
    }

    console.warn("Invalid list item addon when verifying if installed");
    return false;
  }

  private selectInitialTab(): Observable<void> {
    return from(this._wowupService.getKeepLastAddonDetailTab()).pipe(
      takeUntil(this._destroy$),
      first(),
      map((shouldUseLastTab) => {
        this.selectedTabIndex = shouldUseLastTab
          ? this.getSelectedTabTypeIndex(this._sessionService.getSelectedDetailsTab())
          : 0;
        this._cdRef.detectChanges();
      }),
      catchError((e) => {
        console.error(e);
        return of(undefined);
      })
    );
  }
}
