import { Component, OnInit } from "@angular/core";
import { WowInstallation } from "../../../models/wowup/wow-installation";
import { AddonBrokerService, ExportPayload, ExportSummary } from "../../../services/addons/addon-broker.service";
import { AddonService } from "../../../services/addons/addon.service";
import { SessionService } from "../../../services/session/session.service";

@Component({
  selector: "app-addon-manage-dialog",
  templateUrl: "./addon-manage-dialog.component.html",
  styleUrls: ["./addon-manage-dialog.component.scss"],
})
export class AddonManageDialogComponent implements OnInit {
  public readonly selectedInstallation: WowInstallation;

  public exportSummary: ExportSummary | undefined;
  public exportPayload!: string;
  public importData: string = "";

  public constructor(
    private _addonSevice: AddonService,
    private _addonBrokerService: AddonBrokerService,
    private _sessionService: SessionService
  ) {
    this.selectedInstallation = this._sessionService.getSelectedWowInstallation();
  }

  public ngOnInit(): void {
    this.exportSummary = this._addonBrokerService.getExportSummary(this.selectedInstallation);

    const payload = this._addonBrokerService.getExportPayload(this.selectedInstallation);
    this.exportPayload = btoa(JSON.stringify(payload));
  }

  public async onClickImport() {
    try {
      const importJson: ExportPayload = JSON.parse(atob(this.importData));
      console.debug(importJson);

      await this._addonBrokerService.getImportSummary(importJson, this.selectedInstallation);
    } catch (e) {
      console.error(e);
    }
  }
}
