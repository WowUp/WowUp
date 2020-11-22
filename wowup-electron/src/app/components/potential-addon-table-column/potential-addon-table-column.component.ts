import * as _ from "lodash";
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { AddonDependencyType } from "../../models/wowup/addon-dependency-type";
import { GetAddonListItem } from "../../business-objects/get-addon-list-item";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { AddonChannelType } from "../../models/wowup/addon-channel-type";
import { AddonSearchResult } from "../../models/wowup/addon-search-result";
import * as SearchResults from "../../utils/search-result.utils";
import { GetAddonListItemFilePropPipe } from "../../pipes/get-addon-list-item-file-prop.pipe";
import { AddonSearchResultDependency } from "../../models/wowup/addon-search-result-dependency";

export interface PotentialAddonViewDetailsEvent {
  searchResult: AddonSearchResult;
  channelType: AddonChannelType;
}

@Component({
  selector: "app-potential-addon-table-column",
  templateUrl: "./potential-addon-table-column.component.html",
  styleUrls: ["./potential-addon-table-column.component.scss"],
})
export class PotentialAddonTableColumnComponent implements OnChanges {
  @Input("addon") addon: GetAddonListItem;
  @Input() channel: AddonChannelType;
  @Input() clientType: WowClientType;

  @Output() onViewDetails: EventEmitter<PotentialAddonViewDetailsEvent> = new EventEmitter();

  private _latestChannelType: AddonChannelType = AddonChannelType.Stable;
  private _requiredDependencies: AddonSearchResultDependency[] = [];

  public get isBetaChannel(): boolean {
    return this._latestChannelType === AddonChannelType.Beta;
  }

  public get isAlphaChannel(): boolean {
    return this._latestChannelType === AddonChannelType.Alpha;
  }

  public get hasThumbnail() {
    return !!this.addon.thumbnailUrl;
  }

  public get thumbnailLetter() {
    return this.addon.name.charAt(0).toUpperCase();
  }

  get dependencyTooltip() {
    return {
      dependencyCount: this.getRequiredDependencyCount(),
    };
  }

  constructor(private _getAddonListItemFileProp: GetAddonListItemFilePropPipe) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.clientType) {
      this._latestChannelType = this._getAddonListItemFileProp.transform(
        this.addon,
        "channelType",
        this.channel
      ) as AddonChannelType;

      this._requiredDependencies = this.getRequiredDependencies();
    }
  }

  viewDetails() {
    this.onViewDetails.emit({
      searchResult: this.addon.searchResult,
      channelType: this._latestChannelType,
    });
  }

  getRequiredDependencyCount() {
    return this._requiredDependencies.length;
  }

  hasRequiredDependencies() {
    return this._requiredDependencies.length > 0;
  }

  getRequiredDependencies() {
    return SearchResults.getDependencyType(
      this.addon.searchResult,
      this._latestChannelType,
      AddonDependencyType.Required
    );
  }
}
