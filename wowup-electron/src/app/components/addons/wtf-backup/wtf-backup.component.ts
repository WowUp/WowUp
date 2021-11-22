import { Component, OnInit } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { BehaviorSubject, from, of } from "rxjs";
import { catchError, first, map, switchMap } from "rxjs/operators";
import { WowInstallation } from "../../../../common/warcraft/wow-installation";
import { ElectronService } from "../../../services";
import { DialogFactory } from "../../../services/dialog/dialog.factory";
import { SessionService } from "../../../services/session/session.service";
import { SnackbarService } from "../../../services/snackbar/snackbar.service";
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
  public readonly busyText$ = new BehaviorSubject<string>("");
  public readonly busyTextParams$ = new BehaviorSubject<any>({ count: "" });

  public readonly selectedInstallation: WowInstallation;
  public readonly hasBackups$ = this.backups$.pipe(map((backups) => backups.length > 0));
  public readonly backupCt$ = this.backups$.pipe(map((backups) => backups.length));
  public readonly backupPath: string;

  public constructor(
    private _electronService: ElectronService,
    private _sessionService: SessionService,
    private _wtfService: WtfService,
    private _snackbarService: SnackbarService,
    private _dialogFactory: DialogFactory,
    private _translateService: TranslateService
  ) {
    this.selectedInstallation = this._sessionService.getSelectedWowInstallation();
    this.backupPath = this._wtfService.getBackupPath(this.selectedInstallation);
  }

  public ngOnInit(): void {
    this.loadBackups().catch((e) => console.error(e));
  }

  public async onShowFolder(): Promise<void> {
    const backupPath = this._wtfService.getBackupPath(this.selectedInstallation);
    await this._electronService.showItemInFolder(backupPath);
  }

  public onClickApplyBackup(backup: WtfBackupViewModel): void {
    const title: string = this._translateService.instant("WTF_BACKUP.APPLY_CONFIRMATION.TITLE");
    const message: string = this._translateService.instant("WTF_BACKUP.APPLY_CONFIRMATION.MESSAGE", {
      name: backup.title,
    });
    const dialogRef = this._dialogFactory.getConfirmDialog(title, message);

    dialogRef
      .afterClosed()
      .pipe(
        first(),
        switchMap((result) => {
          if (!result) {
            return of(undefined);
          }

          this.busy$.next(true);
          this.busyText$.next("WTF_BACKUP.BUSY_TEXT.APPLYING_BACKUP");

          return from(this._wtfService.applyBackup(backup.title, this.selectedInstallation)).pipe(map(() => true));
        }),
        catchError((e) => {
          console.error(e);
          this._snackbarService.showErrorSnackbar("WTF_BACKUP.ERROR.BACKUP_APPLY_FAILED", {
            timeout: 2000,
            localeArgs: {
              name: backup.title,
            },
          });

          return of(false);
        })
      )
      .subscribe((result) => {
        this.busy$.next(false);

        if (result === true) {
          this._snackbarService.showSuccessSnackbar("WTF_BACKUP.BACKUP_APPLY_SUCCESS", {
            timeout: 2000,
            localeArgs: {
              name: backup.title,
            },
          });
        }
      });
  }

  public onClickDeleteBackup(backup: WtfBackupViewModel): void {
    const title: string = this._translateService.instant("WTF_BACKUP.DELETE_CONFIRMATION.TITLE");
    const message: string = this._translateService.instant("WTF_BACKUP.DELETE_CONFIRMATION.MESSAGE", {
      name: backup.title,
    });
    const dialogRef = this._dialogFactory.getConfirmDialog(title, message);

    dialogRef
      .afterClosed()
      .pipe(
        first(),
        switchMap((result) => {
          if (!result) {
            return of(undefined);
          }

          this.busyText$.next("WTF_BACKUP.BUSY_TEXT.REMOVING_BACKUP");
          this.busy$.next(true);

          return from(this._wtfService.deleteBackup(backup.title, this.selectedInstallation)).pipe(
            switchMap(() => from(this.loadBackups()))
          );
        }),
        catchError((e) => {
          console.error("Failed to delete backup", e);
          this._snackbarService.showErrorSnackbar("WTF_BACKUP.ERROR.FAILED_TO_DELETE", {
            timeout: 2000,
            localeArgs: {
              name: backup.title,
            },
          });

          return of(undefined);
        })
      )
      .subscribe(() => {
        this.busy$.next(false);
      });
  }

  public async onCreateBackup(): Promise<void> {
    this.busyText$.next("WTF_BACKUP.BUSY_TEXT.CREATING_BACKUP");
    this.busy$.next(true);

    try {
      await this._wtfService.createBackup(this.selectedInstallation, (count) => {
        this.busyTextParams$.next({ count });
      });
      await this.loadBackups();
    } catch (e) {
      console.error(e);
    } finally {
      this.busy$.next(false);
      this.busyTextParams$.next({ count: "" });
    }
  }

  private async loadBackups() {
    this.busyText$.next("WTF_BACKUP.BUSY_TEXT.LOADING_BACKUPS");
    this.busy$.next(true);

    try {
      const backups = await this._wtfService.getBackupList(this.selectedInstallation);
      const viewModels = backups.map((b) => this.toViewModel(b));
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
