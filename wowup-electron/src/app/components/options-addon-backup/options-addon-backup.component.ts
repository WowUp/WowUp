import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { MatSlideToggleChange } from "@angular/material/slide-toggle";
import { Subscription } from "rxjs";
import { switchMap } from "rxjs/operators";
import { WowInstallation } from "../../models/wowup/wow-installation";
import { SnackbarService } from "../../services/snackbar/snackbar.service";
import { WarcraftInstallationService } from "../../services/warcraft/warcraft-installation.service";
import { WowUpBackupAddonService } from "../../services/wowup/wowup-backup-addon.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { RestoreDialogComponent } from "../restore-dialog/restore-dialog.component";
@Component({
  selector: "app-options-addon-backup",
  templateUrl: "./options-addon-backup.component.html",
  styleUrls: ["./options-addon-backup.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionsAddonBackupComponent implements OnInit, OnDestroy {
  public backupProcessing = false;
  public restoreProcessing = false;
  public backupEnabled = false;
  public automaticBackupEnabled = false;
  public storageType = ["Local"];
  public storageSelected = "Local";

  public hasWowClients = false;

  private _clientObs: Subscription;
  public constructor(
    private _snackBar: SnackbarService,
    private _dialog: MatDialog,
    public wowUpBackupAddonService: WowUpBackupAddonService,
    private _wowupService: WowUpService,
    private _warcraftInstallationService: WarcraftInstallationService
  ) {}

  public ngOnInit(): void {
    this.backupEnabled = this._wowupService.enabledBackup;
    this.automaticBackupEnabled = this._wowupService.enabledBackup && this._wowupService.enabledAutomaticBackup;

    this._clientObs = this._warcraftInstallationService.wowInstallations$.subscribe((clients) =>
      this._initView(clients)
    );
  }

  public ngOnDestroy(): void {
    this._clientObs.unsubscribe();
  }

  public async onEnableBackupChange(evt: MatSlideToggleChange): Promise<void> {
    this._wowupService.setEnableBackup(evt.checked);
    if (!evt.checked) {
      this.wowUpBackupAddonService.stopBackgroundBackup();
      this.automaticBackupEnabled = false;
    } else {
      await this.wowUpBackupAddonService.startBackgroundBackup();
      this.automaticBackupEnabled = this._wowupService.enabledAutomaticBackup;
    }
  }

  public async onEnableAutomaticBackupChange(evt: MatSlideToggleChange): Promise<void> {
    this._wowupService.setEnableAutomaticBackup(evt.checked);
    if (!evt.checked) {
      this.wowUpBackupAddonService.stopBackgroundBackup();
    } else {
      await this.wowUpBackupAddonService.startBackgroundBackup();
    }
  }

  public async onBackup(): Promise<void> {
    if (!this.backupEnabled) {
      return;
    }

    this.backupProcessing = true;
    const error = await this.wowUpBackupAddonService.backup(Date.now());
    if (error !== "") {
      this._snackBar.showSnackbar(error);
    }
    this.backupProcessing = false;
  }

  public onOpenDialogRestore(): void {
    this._dialog
      .open(RestoreDialogComponent, {
        width: "450px",
        height: "400px",
      })
      .afterClosed()
      .pipe(switchMap((backup) => this._restoreFile(backup)))
      .subscribe();
  }

  private _initView(clients: WowInstallation[]): void {
    this.wowUpBackupAddonService.clients = clients.map(({ clientType, label, location }) => {
      return {
        clientType,
        name: label,
        location: location.replace(/\/([a-zA-Z]*).exe$/g, ""),
      };
    });
    if (clients.length > 0) {
      this.hasWowClients = true;
      void this.wowUpBackupAddonService.startBackgroundBackup();
    } else {
      this.hasWowClients = false;
      this.wowUpBackupAddonService.stopBackgroundBackup();
    }
  }

  private async _restoreFile(backupFile: { file: string; clientLocation: string }) {
    if (!backupFile) {
      return;
    }

    const { file, clientLocation } = backupFile;
    this.restoreProcessing = true;
    const error = await this.wowUpBackupAddonService.restore(file, clientLocation);
    if (error !== "") {
      this._snackBar.showSnackbar(error);
    }
    this.restoreProcessing = false;
  }
}
