import { Component, Inject, OnInit } from "@angular/core";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { AddonService } from "app/services/addons/addon.service";
import { WarcraftService } from "app/services/warcraft/warcraft.service";
import { WowUpService } from "app/services/wowup/wowup.service";

@Component({
  selector: "app-legacy-import-dialog",
  templateUrl: "./legacy-import-dialog.component.html",
  styleUrls: ["./legacy-import-dialog.component.scss"],
})
export class LegacyImportDialogComponent implements OnInit {
  public busy = false;
  public success = false;

  constructor(
    private _addonService: AddonService,
    private _warcraftService: WarcraftService,
    private _wowupService: WowUpService,
    public dialogRef: MatDialogRef<LegacyImportDialogComponent>
  ) {}

  ngOnInit(): void {}

  public async onNegative() {
    this._wowupService.showLegacyImportPrompt = false;

    this.dialogRef.close(false);
  }

  public async onPositive() {
    this.busy = true;

    try {
      const legacyData = await this._wowupService.importLegacyDatabse();
      this._warcraftService.importLegacyPreferences(legacyData.preferences);
      await this._addonService.importLegacyAddons(legacyData.addons);

      this._wowupService.showLegacyImportPrompt = false;
      this.success = true;
      this.busy = false;
      window.setTimeout(() => {
        this.dialogRef.close(false);
      }, 3000);
    } catch (e) {
      console.error("Failed during legacy import", e);
      this.dialogRef.close(false);
    }
  }
}
