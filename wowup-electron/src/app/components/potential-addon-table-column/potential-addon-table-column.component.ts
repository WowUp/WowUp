import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
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
export class PotentialAddonTableColumnComponent implements OnInit {
  @Input("addon") addon: GetAddonListItem;

  @Output() onViewDetails: EventEmitter<AddonSearchResult> = new EventEmitter();

  public get addonVersion() {
    const defaultChannel = this._wowupService.getDefaultAddonChannel(
      this._sessionService.selectedClientType
    );
    const latestFile = this.addon.getLatestFile(defaultChannel);
    return latestFile?.version;
  }

  constructor(
    private _sessionService: SessionService,
    private _wowupService: WowUpService
  ) {}

  ngOnInit(): void {}

  viewDetails() {
    this.onViewDetails.emit(this.addon.searchResult);
  }
}
