import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from "@angular/core";
import { GetAddonListItem } from "app/business-objects/get-addon-list-item";
import { AddonChannelType } from "app/models/wowup/addon-channel-type";
import { AddonSearchResult } from "app/models/wowup/addon-search-result";
import { SessionService } from "app/services/session/session.service";
import { WowUpService } from "app/services/wowup/wowup.service";

@Component({
  selector: "app-potential-addon-table-column",
  templateUrl: "./potential-addon-table-column.component.html",
  styleUrls: ["./potential-addon-table-column.component.scss"],
})
export class PotentialAddonTableColumnComponent implements OnInit, OnChanges {
  @Input("addon") addon: GetAddonListItem;
  @Input() channel: AddonChannelType;

  @Output() onViewDetails: EventEmitter<AddonSearchResult> = new EventEmitter();

  public addonVersion: string = "";

  constructor(
    private _sessionService: SessionService,
    private _wowupService: WowUpService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.channel) {
      const latestFile = this.addon.getLatestFile(this.channel);
      this.addonVersion = latestFile?.version;
    }
  }

  ngOnInit(): void {
    // this._defaultChannel = this._wowupService.getDefaultAddonChannel(
    //   this._sessionService.selectedClientType
    // );
  }

  viewDetails() {
    this.onViewDetails.emit(this.addon.searchResult);
  }
}
