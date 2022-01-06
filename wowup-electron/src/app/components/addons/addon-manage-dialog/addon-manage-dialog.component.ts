import { Component, OnDestroy, OnInit } from "@angular/core";
import { BehaviorSubject, Subscription } from "rxjs";
import { map } from "rxjs/operators";
import { AddonInstallState } from "../../../models/wowup/addon-install-state";
import { WowInstallation } from "../../../../common/warcraft/wow-installation";
import {
  AddonBrokerService,
  ExportPayload,
  ExportSummary,
  ImportComparison,
  ImportSummary,
} from "../../../services/addons/addon-broker.service";
import { SessionService } from "../../../services/session/session.service";
import { SnackbarService } from "../../../services/snackbar/snackbar.service";
import { ElectronService } from "../../../services";

interface ImportComparisonViewModel extends ImportComparison {
  isInstalling?: boolean;
  isCompleted?: boolean;
  didError?: boolean;
}

interface ImportSummaryViewModel extends ImportSummary {
  comparisons: ImportComparisonViewModel[];
}

@Component({
  selector: "app-addon-manage-dialog",
  templateUrl: "./addon-manage-dialog.component.html",
  styleUrls: ["./addon-manage-dialog.component.scss"],
})
export class AddonManageDialogComponent implements OnInit, OnDestroy {
  private readonly _subscriptions: Subscription[] = [];

  public readonly selectedTab$ = new BehaviorSubject<number>(0);
  public readonly error$ = new BehaviorSubject<string>("");

  public readonly TAB_IDX_EXPORT = 0;
  public readonly TAB_IDX_IMPORT = 1;
  public readonly selectedInstallation: WowInstallation;

  public exportSummary: ExportSummary | undefined;
  public exportPayload!: string;
  public importData = "";
  public installing$ = new BehaviorSubject<boolean>(false);
  public importSummary$ = new BehaviorSubject<ImportSummaryViewModel | undefined>(undefined);
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
    private _electronService: ElectronService,
    private _addonBrokerService: AddonBrokerService,
    private _sessionService: SessionService,
    private _snackbarService: SnackbarService
  ) {
    this.selectedInstallation = this._sessionService.getSelectedWowInstallation();
  }

  public ngOnInit(): void {
    this.initAsync().catch((e) => console.error(e));
  }

  public ngOnDestroy(): void {
    this._subscriptions.forEach((sub) => sub.unsubscribe());
  }

  public onClickCopy(): void {
    this._snackbarService.showSuccessSnackbar("ADDON_IMPORT.EXPORT_STRING_COPIED", {
      timeout: 2000,
    });
  }

  public async onClickPaste(): Promise<void> {
    try {
      const txt = await this._electronService.readClipboardText();
      this.importData = txt;

      this._snackbarService.showSuccessSnackbar("ADDON_IMPORT.EXPORT_STRING_PASTED", {
        timeout: 2000,
      });
    } catch (e) {
      console.error(e);
    }
  }

  public async onClickInstall(): Promise<void> {
    try {
      this.installing$.next(true);
      await this._addonBrokerService.installImportSummary(this.importSummary$.value, this.selectedInstallation);
    } catch (e) {
      console.error(e);
    } finally {
      this.installing$.next(false);
    }
  }

  public async onClickImport(): Promise<void> {
    let importJson: ExportPayload;
    try {
      importJson = await this._addonBrokerService.parseImportString(this.importData);
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

      const viewModel = this.getImportSummaryViewModel(importSummary);
      this.importSummary$.next(viewModel);
    } catch (e) {
      console.error(e);
      this._snackbarService.showErrorSnackbar("ADDON_IMPORT.GENERIC_IMPORT_ERROR", {
        timeout: 2000,
      });
    }
  }

  private async initAsync() {
    try {
      this.exportSummary = await this._addonBrokerService.getExportSummary(this.selectedInstallation);

      const payload = await this._addonBrokerService.getExportPayload(this.selectedInstallation);

      this._electronService
        .invoke("base64-encode", JSON.stringify(payload))
        .then((b64) => {
          console.debug("B64", b64);
          this.exportPayload = b64;
        })
        .catch((e) => {
          console.error(e);
          this.error$.next(`ERROR`);
        });

      const installSub = this._addonBrokerService.addonInstall$.subscribe((evt) => {
        console.log("Install", evt);

        const viewModel = { ...this.importSummary$.value };
        const compVm = viewModel.comparisons.find((comp) => comp.id === evt.comparisonId);
        compVm.isInstalling = true;
        compVm.isCompleted = evt.installState === AddonInstallState.Complete;
        compVm.didError = evt.installState === AddonInstallState.Error;

        this.importSummary$.next(viewModel);
      });

      this._subscriptions.push(installSub);
    } catch (e) {
      console.error(e);
      this.error$.next(`ERROR`);
    }
  }

  private getImportSummaryViewModel(importSummary: ImportSummary): ImportSummaryViewModel {
    const viewModel: ImportSummaryViewModel = { ...importSummary };

    viewModel.comparisons.forEach((comp) => {
      comp.isInstalling = false;
      comp.didError = false;
      comp.isCompleted = false;
    });

    return viewModel;
  }
}
