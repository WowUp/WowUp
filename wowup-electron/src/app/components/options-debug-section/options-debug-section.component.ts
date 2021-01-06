import { ChangeDetectorRef, Component, NgZone, OnInit } from "@angular/core";
import { AddonService } from "../../services/addons/addon.service";
import { WowUpService } from "../../services/wowup/wowup.service";

@Component({
  selector: "app-options-debug-section",
  templateUrl: "./options-debug-section.component.html",
  styleUrls: ["./options-debug-section.component.scss"],
})
export class OptionsDebugSectionComponent implements OnInit {
  public dumpingDebugData = false;

  constructor(
    private _cdRef: ChangeDetectorRef,
    private _addonService: AddonService,
    private _wowupService: WowUpService
  ) {}

  ngOnInit(): void {}

  public onShowLogs = () => {
    this._wowupService.showLogsFolder();
  };

  public async onLogDebugData() {
    this.dumpingDebugData = true;

    await this._addonService.logDebugData();

    this.dumpingDebugData = false;
    this._cdRef.detectChanges();
  }
}
