import { ChangeDetectionStrategy, Component } from "@angular/core";
import { MatDialogRef } from "@angular/material/dialog";
import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { RelativeDurationPipe } from "../../pipes/relative-duration-pipe";
import { WowUpBackupAddonService } from "../../services/wowup/wowup-backup-addon.service";

export interface BackupFolder {
  date: Date;
  name: string;
}

@Component({
  selector: "app-restore-dialog",
  templateUrl: "./restore-dialog.component.html",
  styleUrls: ["./restore-dialog.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestoreDialogComponent {
  public displayedColumns: string[] = ["date", "action"];
  public dataSource: BackupFolder[] = [];
  public selectedClient = WowClientType.None;

  private _clientLocation: string;

  public constructor(
    private _dialogRef: MatDialogRef<RestoreDialogComponent>,
    public wowUpBackupAddonService: WowUpBackupAddonService,
    public relativeDurationPipe: RelativeDurationPipe
  ) {}

  public onClientChange(): void {
    const { location } = this.wowUpBackupAddonService.clients.find(
      ({ clientType }) => clientType === this.selectedClient
    );

    this._clientLocation = `${location}`;
    this.dataSource = this.wowUpBackupAddonService
      .getBackupFiles(this._clientLocation)
      .map((file) => {
        return {
          date: new Date(Number(file.replace(".zip", ""))),
          name: file,
        };
      })
      .sort((a, b) => {
        return b.date.getTime() - a.date.getTime();
      });
  }
  public onDeleteFile(file: string): void {
    const { location } = this.wowUpBackupAddonService.clients.find(
      ({ clientType }) => clientType === this.selectedClient
    );
    this.wowUpBackupAddonService.deleteBackup(location, file);
    this.dataSource = this.dataSource.filter(({ name }) => name !== file);
  }

  public onApply(file: string): void {
    this._dialogRef.close({
      file: `${this._clientLocation}/${this.wowUpBackupAddonService.backupFolderName}/${file}`,
      clientLocation: this._clientLocation,
    });
  }
}
