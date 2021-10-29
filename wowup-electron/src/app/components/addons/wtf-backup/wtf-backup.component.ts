import { Component, OnInit } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { map } from "rxjs/operators";
import { WowInstallation } from "../../../../common/warcraft/wow-installation";
import { ElectronService } from "../../../services";
import { SessionService } from "../../../services/session/session.service";
import { WtfBackup, WtfService } from "../../../services/wtf/wtf.service";
import { formatSize } from "../../../utils/number.utils";

interface WtfBackupViewModel {
  title: string;
  size: string;
  date: number;
  error?: string;
}

@Component({
  selector: "app-wtf-backup",
  templateUrl: "./wtf-backup.component.html",
  styleUrls: ["./wtf-backup.component.scss"],
})
export class WtfBackupComponent implements OnInit {
  public readonly busy$ = new BehaviorSubject<boolean>(false);
  public readonly backups$ = new BehaviorSubject<WtfBackupViewModel[]>([]);

  public readonly selectedInstallation: WowInstallation;
  public readonly hasBackups$ = this.backups$.pipe(map((backups) => backups.length > 0));
  public readonly backupCt$ = this.backups$.pipe(map((backups) => backups.length));
  public readonly backupPath: string;

  constructor(
    private _electronService: ElectronService,
    private _sessionService: SessionService,
    private _wtfService: WtfService
  ) {
    this.selectedInstallation = this._sessionService.getSelectedWowInstallation();
    this.backupPath = this._wtfService.getBackupPath(this.selectedInstallation);
  }

  ngOnInit(): void {
    this.loadBackups();
  }

  async onShowFolder(): Promise<void> {
    const backupPath = this._wtfService.getBackupPath(this.selectedInstallation);
    await this._electronService.openPath(backupPath);
  }

  async onCreateBackup(): Promise<void> {
    this.busy$.next(true);
    try {
      await this._wtfService.createBackup(this.selectedInstallation);
      await this.loadBackups();
    } catch (e) {
      console.error(e);
    } finally {
      this.busy$.next(false);
    }
  }

  private async loadBackups() {
    this.busy$.next(true);
    try {
      const backups = await this._wtfService.getBackupList(this.selectedInstallation);
      console.debug(backups);

      const viewModels = backups.map((b) => this.toViewModel(b));
      console.debug(viewModels);
      this.backups$.next(viewModels);
    } catch (e) {
      console.error(e);
    } finally {
      this.busy$.next(false);
    }
  }

  private toViewModel(backup: WtfBackup): WtfBackupViewModel {
    return {
      title: backup.fileName,
      size: formatSize(backup.size),
      date: backup.metadata?.createdAt ?? backup.birthtimeMs,
      error: backup.error,
    };
  }
}
