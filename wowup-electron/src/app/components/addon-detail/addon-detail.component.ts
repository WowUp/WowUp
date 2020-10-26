import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  OnDestroy,
  OnInit,
} from "@angular/core";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";
import { AddonViewModel } from "../../business-objects/my-addon-list-item";
import { AddonSearchResult } from "../../models/wowup/addon-search-result";
import { AddonService } from "../../services/addons/addon.service";

export interface AddonDetailModel {
  listItem?: AddonViewModel;
  searchResult?: AddonSearchResult;
}

@Component({
  selector: "app-addon-detail",
  templateUrl: "./addon-detail.component.html",
  styleUrls: ["./addon-detail.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddonDetailComponent implements OnInit, OnDestroy {
  private readonly _subscriptions: Subscription[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public model: AddonDetailModel,
    private _addonService: AddonService,
    private _translateService: TranslateService,
    private _cdRef: ChangeDetectorRef
  ) {
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
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this._subscriptions.forEach((sub) => sub.unsubscribe());
  }

  get statusText() {
    if (!this.model.listItem) {
      return "";
    }

    if (this.model.listItem.isUpToDate) {
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
    return (
      this.model.listItem?.addon?.name ||
      this.model.searchResult?.name ||
      "UNKNOWN"
    );
  }

  get subtitle() {
    return (
      this.model.listItem?.addon?.author ||
      this.model.searchResult?.author ||
      "UNKNOWN"
    );
  }

  get provider() {
    return (
      this.model.listItem?.addon?.providerName ||
      this.model.searchResult?.providerName ||
      "UNKNOWN"
    );
  }

  get summary() {
    return (
      this.model.listItem?.addon?.summary ||
      this.model.searchResult?.summary ||
      "UNKNOWN"
    );
  }

  get externalUrl() {
    return (
      this.model.listItem?.addon?.externalUrl ||
      this.model.searchResult?.externalUrl ||
      "UNKNOWN"
    );
  }

  get defaultImageUrl(): string {
    if (this.model.listItem?.addon) {
      if (this.model.listItem?.addon?.screenshotUrls?.length) {
        return this.model.listItem?.addon.screenshotUrls[0];
      }
      return this.model.listItem?.addon.thumbnailUrl || "";
    }

    if (this.model.searchResult) {
      if (this.model.searchResult?.screenshotUrls?.length) {
        return this.model.searchResult.screenshotUrls[0];
      }
      return this.model.searchResult?.thumbnailUrl || "";
    }

    return "";
  }
}
