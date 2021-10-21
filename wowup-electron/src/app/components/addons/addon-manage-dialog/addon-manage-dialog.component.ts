import { Component, OnInit, ViewChild } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { map } from "rxjs/operators";
import { WowInstallation } from "../../../models/wowup/wow-installation";
import {
  AddonBrokerService,
  ExportPayload,
  ExportSummary,
  ImportSummary,
} from "../../../services/addons/addon-broker.service";
import { AddonService } from "../../../services/addons/addon.service";
import { SessionService } from "../../../services/session/session.service";
import { SnackbarService } from "../../../services/snackbar/snackbar.service";

@Component({
  selector: "app-addon-manage-dialog",
  templateUrl: "./addon-manage-dialog.component.html",
  styleUrls: ["./addon-manage-dialog.component.scss"],
})
export class AddonManageDialogComponent implements OnInit {
  public readonly selectedTab$ = new BehaviorSubject<number>(0);

  public readonly TAB_IDX_EXPORT = 0;
  public readonly TAB_IDX_IMPORT = 1;
  public readonly selectedInstallation: WowInstallation;

  public exportSummary: ExportSummary | undefined;
  public exportPayload!: string;
  public importData: string = "";
  public importSummary$ = new BehaviorSubject<ImportSummary | undefined>(undefined);
  public hasImportSummary$ = this.importSummary$.pipe(map((summary) => summary !== undefined));
  public importSummaryAddedCt$ = this.importSummary$.pipe(map((summary) => summary?.addedCt ?? 0));
  public importSummaryConflictCt$ = this.importSummary$.pipe(map((summary) => summary?.conflictCt ?? 0));
  public importSummaryNoChangeCt$ = this.importSummary$.pipe(map((summary) => summary?.noChangeCt ?? 0));
  public importSummaryComparisons$ = this.importSummary$.pipe(map((summary) => summary?.comparisons ?? []));
  public importSummaryComparisonCt$ = this.importSummary$.pipe(map((summary) => summary?.comparisons?.length ?? 0));
  public canInstall$ = this.importSummary$.pipe(
    map((summary) => {
      if (!summary) {
        return false;
      }

      // if there are any new addons, we can install
      return summary.comparisons.some((comp) => comp.state === "added");
    })
  );

  public constructor(
    private _addonSevice: AddonService,
    private _addonBrokerService: AddonBrokerService,
    private _sessionService: SessionService,
    private _snackbarService: SnackbarService
  ) {
    this.selectedInstallation = this._sessionService.getSelectedWowInstallation();
  }

  public ngOnInit(): void {
    this.exportSummary = this._addonBrokerService.getExportSummary(this.selectedInstallation);

    const payload = this._addonBrokerService.getExportPayload(this.selectedInstallation);
    this.exportPayload = btoa(JSON.stringify(payload));
  }

  public onClickCopy() {
    this._snackbarService.showSuccessSnackbar("ADDON_IMPORT.EXPORT_STRING_COPIED", {
      timeout: 2000,
    });
  }

  public async onClickImport() {
    let importJson: ExportPayload;
    try {
      importJson = this._addonBrokerService.parseImportString(this.importData);
      console.debug(importJson);
    } catch (e) {
      console.error(e);
      this._snackbarService.showErrorSnackbar("ADDON_IMPORT.IMPORT_STRING_INVALID", {
        timeout: 2000,
      });
      return;
    }

    try {
      const importSummary = await this._addonBrokerService.getImportSummary(importJson, this.selectedInstallation);
      console.debug(importSummary);

      if (importSummary.errorCode !== undefined) {
        this._snackbarService.showErrorSnackbar(`ADDON_IMPORT.${importSummary.errorCode}`, {
          timeout: 2000,
        });
        return;
      }

      this.importSummary$.next(importSummary);
    } catch (e) {
      console.error(e);
      this._snackbarService.showErrorSnackbar("ADDON_IMPORT.GENERIC_IMPORT_ERROR", {
        timeout: 2000,
      });
    }
  }
}
