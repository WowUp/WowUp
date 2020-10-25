import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from "@angular/core";
import { GetAddonListItem } from "app/business-objects/get-addon-list-item";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { AddonChannelType } from "app/models/wowup/addon-channel-type";
import { AddonSearchResult } from "app/models/wowup/addon-search-result";
import { GetAddonListItemFilePropPipe } from "app/pipes/get-addon-list-item-file-prop.pipe";

@Component({
  selector: "app-potential-addon-table-column",
  templateUrl: "./potential-addon-table-column.component.html",
  styleUrls: ["./potential-addon-table-column.component.scss"],
})
export class PotentialAddonTableColumnComponent implements OnChanges {
  @Input("addon") addon: GetAddonListItem;
  @Input() channel: AddonChannelType;
  @Input() clientType: WowClientType;

  @Output() onViewDetails: EventEmitter<AddonSearchResult> = new EventEmitter();

  private _latestChannelType: AddonChannelType = AddonChannelType.Stable;

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

  constructor(
    private _getAddonListItemFileProp: GetAddonListItemFilePropPipe
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.clientType) {
      this._latestChannelType = this._getAddonListItemFileProp.transform(this.addon, 'channelType', this.channel) as AddonChannelType;
    }
  }

  viewDetails() {
    this.onViewDetails.emit(this.addon.searchResult);
  }
}
