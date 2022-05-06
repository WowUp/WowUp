import { AgRendererComponent } from "ag-grid-angular";
import { ICellRendererParams } from "ag-grid-community";

import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from "@angular/core";

import { WowClientType } from "../../../../common/warcraft/wow-client-type";
import { AddonChannelType, AddonDependencyType } from "../../../../common/wowup/models";
import { GetAddonListItem } from "../../../business-objects/get-addon-list-item";
import { AddonSearchResult } from "../../../models/wowup/addon-search-result";
import { AddonSearchResultDependency } from "../../../models/wowup/addon-search-result-dependency";
import { GetAddonListItemFilePropPipe } from "../../../pipes/get-addon-list-item-file-prop.pipe";
import { DialogFactory } from "../../../services/dialog/dialog.factory";
import * as SearchResults from "../../../utils/search-result.utils";

export interface PotentialAddonViewDetailsEvent {
  searchResult: AddonSearchResult;
  channelType: AddonChannelType;
}

@Component({
  selector: "app-potential-addon-table-cell",
  templateUrl: "./potential-addon-table-cell.component.html",
  styleUrls: ["./potential-addon-table-cell.component.scss"],
})
export class PotentialAddonTableCellComponent implements AgRendererComponent, OnChanges {
  @Input("addon") public addon!: GetAddonListItem;
  @Input() public channel!: AddonChannelType;
  @Input() public clientType!: WowClientType;

  @Output() public onViewDetails: EventEmitter<PotentialAddonViewDetailsEvent> = new EventEmitter();

  private _latestChannelType: AddonChannelType = AddonChannelType.Stable;
  private _requiredDependencies: AddonSearchResultDependency[] = [];

  public get isBetaChannel(): boolean {
    return this._latestChannelType === AddonChannelType.Beta;
  }

  public get isAlphaChannel(): boolean {
    return this._latestChannelType === AddonChannelType.Alpha;
  }

  public get hasThumbnail(): boolean {
    return !!this.addon.thumbnailUrl;
  }

  public get thumbnailLetter(): string {
    return this.addon.name.charAt(0).toUpperCase();
  }

  public get dependencyTooltip(): { dependencyCount: number } {
    return {
      dependencyCount: this.getRequiredDependencyCount(),
    };
  }

  public get channelTranslationKey(): string {
    return this._latestChannelType === AddonChannelType.Alpha
      ? "COMMON.ENUM.ADDON_CHANNEL_TYPE.ALPHA"
      : "COMMON.ENUM.ADDON_CHANNEL_TYPE.BETA";
  }

  public constructor(
    private _getAddonListItemFileProp: GetAddonListItemFilePropPipe,
    private _dialogFactory: DialogFactory
  ) {}

  public agInit(params: ICellRendererParams): void {
    this.clientType = (params as any).clientType;
    this.channel = (params as any).channel;
    this.addon = params.data;
    this._latestChannelType = this.addon.latestAddonChannel;
  }

  public refresh(): boolean {
    return false;
  }

  public afterGuiAttached?(): void {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.clientType) {
      if (this.addon.latestAddonChannel !== this.channel) {
        this._latestChannelType = this.addon.latestAddonChannel;
      } else {
        this._latestChannelType = this._getAddonListItemFileProp.transform(
          this.addon,
          "channelType",
          this.channel
        ) as AddonChannelType;
      }

      this._requiredDependencies = this.getRequiredDependencies();
    }
  }

  public viewDetails(): void {
    this._dialogFactory.getPotentialAddonDetailsDialog(this.addon.searchResult, this.channel);
  }

  public getRequiredDependencyCount(): number {
    return this._requiredDependencies.length;
  }

  public hasRequiredDependencies(): boolean {
    return this._requiredDependencies.length > 0;
  }

  public getRequiredDependencies(): AddonSearchResultDependency[] {
    return SearchResults.getDependencyType(
      this.addon.searchResult,
      this._latestChannelType,
      AddonDependencyType.Required
    );
  }
}
