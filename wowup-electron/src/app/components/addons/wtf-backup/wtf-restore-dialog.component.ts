import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import type { WtfBackupSource } from "../../../services/wtf/wtf-backup-source";

export interface WtfRestoreDialogData {
  backupName: string;
  source: WtfBackupSource;
  differentGameType: boolean;
  hasConfig: boolean;
  defaultKeepConfig: boolean;
}

export interface WtfRestoreDialogResult {
  keepCurrentConfig: boolean;
}

@Component({
  selector: "app-wtf-restore-dialog",
  templateUrl: "./wtf-restore-dialog.component.html",
  styleUrls: ["./wtf-restore-dialog.component.scss"],
})
export class WtfRestoreDialogComponent {
  public keepCurrentConfig: boolean;

  public constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: WtfRestoreDialogData,
    public readonly dialogRef: MatDialogRef<WtfRestoreDialogComponent, WtfRestoreDialogResult>,
  ) {
    this.keepCurrentConfig = data.hasConfig && data.defaultKeepConfig;
  }

  public onRestore(): void {
    this.dialogRef.close({
      keepCurrentConfig: this.data.hasConfig && this.keepCurrentConfig,
    });
  }
}
