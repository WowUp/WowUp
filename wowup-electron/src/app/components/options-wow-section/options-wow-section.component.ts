import { Component, OnInit } from "@angular/core";
import { MatSelectChange } from "@angular/material/select";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { WowUpReleaseChannelType } from "../../models/wowup/wowup-release-channel-type";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { getEnumList, getEnumName } from "../../utils/enum.utils";

@Component({
  selector: "app-options-wow-section",
  templateUrl: "./options-wow-section.component.html",
  styleUrls: ["./options-wow-section.component.scss"],
})
export class OptionsWowSectionComponent implements OnInit {
  public wowClientTypes: WowClientType[] = getEnumList(WowClientType).filter(
    (clientType) => clientType !== WowClientType.None
  ) as WowClientType[];

  public wowUpReleaseChannel: WowUpReleaseChannelType;

  public wowUpReleaseChannels: {
    type: WowUpReleaseChannelType;
    name: string;
  }[] = getEnumList(WowUpReleaseChannelType).map((type: WowUpReleaseChannelType) => ({
    type,
    name: getEnumName(WowUpReleaseChannelType, type),
  }));

  constructor(private _warcraftService: WarcraftService, private _wowupService: WowUpService) {}

  ngOnInit(): void {
    this.wowUpReleaseChannel = this._wowupService.wowUpReleaseChannel;
  }

  public onReScan = () => {
    this._warcraftService.scanProducts();
  };

  public onWowUpChannelChange(evt: MatSelectChange) {
    this._wowupService.wowUpReleaseChannel = evt.value;
  }
}
