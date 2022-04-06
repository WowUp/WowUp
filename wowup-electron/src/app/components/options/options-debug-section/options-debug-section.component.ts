import { ChangeDetectorRef, Component } from "@angular/core";
import { AddonService } from "../../../services/addons/addon.service";
import { SessionService } from "../../../services/session/session.service";
import { WowUpService } from "../../../services/wowup/wowup.service";

@Component({
  selector: "app-options-debug-section",
  templateUrl: "./options-debug-section.component.html",
  styleUrls: ["./options-debug-section.component.scss"],
})
export class OptionsDebugSectionComponent {
  public dumpingDebugData = false;

  public constructor(
    private _cdRef: ChangeDetectorRef,
    private _addonService: AddonService,
    private _wowupService: WowUpService,
    private _sessionService: SessionService
  ) {}

  public async onShowLogs(): Promise<void> {
    await this._wowupService.showLogsFolder();
  }

  public async onShowConfig(): Promise<void> {
    await this._wowupService.showConfigFolder();
  }

  public async onLogDebugData(): Promise<void> {
    try {
      this.dumpingDebugData = true;
      await this._addonService.logDebugData();
    } catch (e) {
      console.error(e);
    } finally {
      this.dumpingDebugData = false;
      this._cdRef.detectChanges();
    }
  }

  public onDebugAdFrame(): void {
    this._sessionService.debugAdFrame$.next(true);
  }
}
