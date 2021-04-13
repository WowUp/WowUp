import { last } from "lodash";
import { BehaviorSubject, from, of, Subscription } from "rxjs";
import { filter, first, map, switchMap, tap } from "rxjs/operators";

import {
  AfterViewChecked,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from "@angular/material/dialog";
import { MatTabChangeEvent, MatTabGroup } from "@angular/material/tabs";
import { TranslateService } from "@ngx-translate/core";

import { ADDON_PROVIDER_GITHUB, ADDON_PROVIDER_UNKNOWN } from "../../../common/constants";
import { Addon, AddonFundingLink } from "../../../common/entities/addon";
import { AddonChannelType, AddonDependency, AddonDependencyType } from "../../../common/wowup/models";
import { AddonViewModel } from "../../business-objects/addon-view-model";
import { AddonSearchResult } from "../../models/wowup/addon-search-result";
import { AddonSearchResultDependency } from "../../models/wowup/addon-search-result-dependency";
import { AddonUpdateEvent } from "../../models/wowup/addon-update-event";
import { ElectronService } from "../../services";
import { AddonService } from "../../services/addons/addon.service";
import { SessionService } from "../../services/session/session.service";
import { SnackbarService } from "../../services/snackbar/snackbar.service";
import * as SearchResult from "../../utils/search-result.utils";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";

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
export class AddonDetailComponent implements OnInit, OnDestroy, AfterViewChecked, AfterViewInit {
  @ViewChild("descriptionContainer", { read: ElementRef }) public descriptionContainer: ElementRef;
  @ViewChild("changelogContainer", { read: ElementRef }) public changelogContainer: ElementRef;
  @ViewChild("providerLink", { read: ElementRef }) public providerLink: ElementRef;
  @ViewChild("tabs", { static: false }) public tabGroup: MatTabGroup;

  private readonly _subscriptions: Subscription[] = [];
  private readonly _dependencies: AddonSearchResultDependency[];
  private readonly _changelogSrc = new BehaviorSubject<string>("");
  private readonly _descriptionSrc = new BehaviorSubject<string>("");

  public readonly changelog$ = this._changelogSrc.asObservable();
  public readonly description$ = this._descriptionSrc.asObservable();
  public fetchingChangelog = true;
  public fetchingFullDescription = true;
  public selectedTabIndex = 0;
  public requiredDependencyCount = 0;
  public canShowChangelog = true;
  public hasIconUrl = false;
  public thumbnailLetter = "";
  public hasChangeLog = false;
  public showInstallButton = false;
  public showUpdateButton = false;
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

  public constructor(
    @Inject(MAT_DIALOG_DATA) public model: AddonDetailModel,
    private _dialogRef: MatDialogRef<AddonDetailComponent>,
    private _dialog: MatDialog,
    private _addonService: AddonService,
    private _cdRef: ChangeDetectorRef,
    private _electronService: ElectronService,
    private _snackbarService: SnackbarService,
    private _translateService: TranslateService,
    private _sessionService: SessionService
  ) {
    this._dependencies = this.getDependencies();

    const addonInstalledSub = this._addonService.addonInstalled$
      .pipe(filter(this.isSameAddon))
      .subscribe(this.onAddonInstalledUpdate);

    const changelogSub = from(this.getChangelog())
      .pipe(tap(() => (this.fetchingChangelog = false)))
      .subscribe((changelog) => {
        this.hasChangeLog = !!changelog;
        this._changelogSrc.next(changelog);
      });

    const fullDescriptionSub = from(this.getFullDescription())
      .pipe(tap(() => (this.fetchingFullDescription = false)))
      .subscribe((description) => this._descriptionSrc.next(description));

    this._subscriptions.push(changelogSub, fullDescriptionSub, addonInstalledSub);
  }

  public ngOnInit(): void {
    this.canShowChangelog = this._addonService.canShowChangelog(this.getProviderName());

    this.selectedTabIndex = this.getSelectedTabTypeIndex(this._sessionService.getSelectedDetailsTab());

    this.thumbnailLetter = this.getThumbnailLetter();

    this.showInstallButton = !!this.model.searchResult;

    this.showUpdateButton = !!this.model.listItem;

    this.title = this.model.listItem?.addon?.name || this.model.searchResult?.name || "UNKNOWN";

    this.subtitle = this.model.listItem?.addon?.author || this.model.searchResult?.author || "UNKNOWN";

    this.provider = this.model.listItem?.addon?.providerName || this.model.searchResult?.providerName || "UNKNOWN";

    this.summary = this.model.listItem?.addon?.summary || this.model.searchResult?.summary || "";

    this.externalUrl = this.model.listItem?.addon?.externalUrl || this.model.searchResult?.externalUrl || "UNKNOWN";

    this.defaultImageUrl = this.model.listItem?.addon?.thumbnailUrl || this.model.searchResult?.thumbnailUrl || "";

    this.hasIconUrl = !!this.defaultImageUrl;

    this.hasRequiredDependencies = this._dependencies.length > 0;

    this.requiredDependencyCount = this._dependencies.length;

    this.version = this.model.searchResult
      ? this.getLatestSearchResultFile().version
      : this.model.listItem.addon.installedVersion;

    this.fundingLinks = this.model.listItem?.addon?.fundingLinks ?? [];

    this.hasFundingLinks = !!this.model.listItem?.addon?.fundingLinks?.length;

    this.fullExternalId = this.model.searchResult
      ? this.model.searchResult.externalId
      : this.model.listItem.addon.externalId;

    this.displayExternalId = this.getDisplayExternalId(this.fullExternalId);

    this.isUnknownProvider = this.model.listItem?.addon?.providerName === ADDON_PROVIDER_UNKNOWN;

    this.missingDependencies = this.model.listItem?.addon?.missingDependencies ?? [];
    this.isMissingUnknownDependencies = !!this.missingDependencies.length;
  }

  public ngAfterViewInit(): void {}

  public ngAfterViewChecked(): void {
    const descriptionContainer: HTMLDivElement = this.descriptionContainer?.nativeElement;
    const changelogContainer: HTMLDivElement = this.changelogContainer?.nativeElement;
    this.formatLinks(descriptionContainer);
    this.formatLinks(changelogContainer);
  }

  public ngOnDestroy(): void {
    this._subscriptions.forEach((sub) => sub.unsubscribe());
  }

  public onInstallUpdated(): void {
    this._cdRef.detectChanges();
  }

  public onSelectedTabChange(evt: MatTabChangeEvent): void {
    this._sessionService.setSelectedDetailsTab(this.getSelectedTabTypeFromIndex(evt.index));
  }

  public onClickExternalId(): void {
    this._snackbarService.showSuccessSnackbar("DIALOGS.ADDON_DETAILS.COPY_ADDON_ID_SNACKBAR", {
      timeout: 2000,
    });
  }

  public onClickRemoveAddon(): void {
    this.getRemoveAddonPrompt(this.model.listItem.addon.name)
      .afterClosed()
      .pipe(
        first(),
        switchMap((result) => {
          if (!result) {
            return of(false);
          }

          const addon = this.model.listItem.addon;
          if (this._addonService.getRequiredDependencies(addon).length === 0) {
            return from(this._addonService.removeAddon(addon)).pipe(map(() => true));
          } else {
            return this.getRemoveDependenciesPrompt(addon.name, addon.dependencies.length)
              .afterClosed()
              .pipe(
                switchMap((result) => from(this._addonService.removeAddon(addon, result))),
                map(() => true)
              );
          }
        }),
        map((shouldClose) => {
          if (shouldClose) {
            this._dialogRef.close();
          }
        })
      )
      .subscribe();
  }

  private getRemoveAddonPrompt(addonName: string): MatDialogRef<ConfirmDialogComponent, any> {
    const title = this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.TITLE", { count: 1 });
    const message1: string = this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ONE", {
      addonName,
    });
    const message2: string = this._translateService.instant(
      "PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ACTION_EXPLANATION"
    );

    return this._dialog.open(ConfirmDialogComponent, {
      data: {
        title,
        message: `${message1}\n\n${message2}`,
      },
    });
  }

  private getRemoveDependenciesPrompt(
    addonName: string,
    dependencyCount: number
  ): MatDialogRef<ConfirmDialogComponent, any> {
    const title = this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.DEPENDENCY_TITLE");
    const message1: string = this._translateService.instant("PAGES.MY_ADDONS.UNINSTALL_POPUP.DEPENDENCY_MESSAGE", {
      addonName,
      dependencyCount,
    });
    const message2: string = this._translateService.instant(
      "PAGES.MY_ADDONS.UNINSTALL_POPUP.CONFIRMATION_ACTION_EXPLANATION"
    );

    return this._dialog.open(ConfirmDialogComponent, {
      data: {
        title,
        message: `${message1}\n\n${message2}`,
      },
    });
  }

  private getSelectedTabTypeFromIndex(index: number): DetailsTabType {
    return index === 0 ? "description" : "changelog";
  }

  private getSelectedTabTypeIndex(tabType: DetailsTabType): number {
    return tabType === "description" ? 0 : 1;
  }

  private getThumbnailLetter(): string {
    return this.model?.listItem?.thumbnailLetter ?? this.model.searchResult?.name?.charAt(0).toUpperCase();
  }

  private getProviderName(): string {
    return this.model.listItem?.addon?.providerName ?? this.model.searchResult?.providerName;
  }

  private formatLinks(container: HTMLDivElement): void {
    if (!container) {
      return;
    }

    const aTags = container.getElementsByTagName("a");
    for (const tag of Array.from(aTags)) {
      if (tag.getAttribute("clk")) {
        continue;
      }

      if (tag.href.toLowerCase().indexOf("http") === -1 || tag.href.toLowerCase().indexOf("localhost") !== -1) {
        tag.classList.add("no-link");
      }

      tag.setAttribute("clk", "1");
      tag.addEventListener("click", this.onOpenLink, false);
    }
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
      evt.addon.id === this.model.listItem?.addon.id || evt.addon.externalId === this.model.searchResult?.externalId
    );
  };

  private onOpenLink = (e: MouseEvent): boolean => {
    e.preventDefault();

    // Go up the call chain to find the tag
    const path = (e as any).path as HTMLElement[];
    let anchor: HTMLAnchorElement = undefined;
    for (const element of path) {
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

    if (anchor.href.toLowerCase().indexOf("http") !== 0 || anchor.href.toLowerCase().indexOf("localhost") !== -1) {
      console.warn(`Unhandled relative path: ${anchor.href}`);
      return false;
    }

    this.confirmLinkNavigation(anchor.href);

    // this._electronService.openExternal(anchor.href).catch((e) => console.error(e));
    return false;
  };

  private confirmLinkNavigation(href: string) {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant("APP.LINK_NAVIGATION.TITLE"),
        message: this._translateService.instant("APP.LINK_NAVIGATION.MESSAGE", { url: href }),
      },
    });

    dialogRef
      .afterClosed()
      .pipe(first())
      .subscribe((result) => {
        if (!result) {
          return;
        }

        this._electronService.openExternal(href).catch((e) => console.error(e));
      });
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
    const externalId = this.model.searchResult?.externalId ?? this.model.listItem?.addon?.externalId;
    const providerName = this.model.searchResult?.providerName ?? this.model.listItem?.addon?.providerName;

    if (providerName === ADDON_PROVIDER_GITHUB) {
      return this.model.listItem?.addon?.summary;
    }

    try {
      return await this._addonService.getFullDescription(
        this._sessionService.getSelectedWowInstallation(),
        providerName,
        externalId,
        this.model?.listItem?.addon
      );
    } catch (e) {
      return "";
    }
  };

  private getDependencies(): AddonDependency[] {
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

  private async getSearchResultChangelog() {
    return await this._addonService.getChangelogForSearchResult(
      this._sessionService.getSelectedWowInstallation(),
      this.model.channelType,
      this.model.searchResult
    );
  }

  private async getMyAddonChangelog() {
    return await this._addonService.getChangelogForAddon(
      this._sessionService.getSelectedWowInstallation(),
      this.model.listItem?.addon
    );
  }

  private getDisplayExternalId(externalId: string): string {
    if (externalId.indexOf("/") !== -1) {
      return `...${last(externalId.split("/"))}`;
    }

    return externalId;
  }

  private getLatestSearchResultFile() {
    return SearchResult.getLatestFile(this.model.searchResult, this.model.channelType);
  }
}
