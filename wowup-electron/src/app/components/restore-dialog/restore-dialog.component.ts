import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import * as AdmZip from "adm-zip";
import * as fs from 'fs';
import * as moment from 'moment';
import * as rimraf from 'rimraf';
@Component({
  selector: 'app-restore-dialog',
  templateUrl: './restore-dialog.component.html',
  styleUrls: ['./restore-dialog.component.scss']
})
export class RestoreDialogComponent implements OnInit {
  displayedColumns: string[] = ['Date', 'Restore', 'Delete'];
  dataSource: string[];


  private _archives: string[];
  constructor(public dialogRef: MatDialogRef<RestoreDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { pathBackup: string, fullPath: string },
    private _snackBar: MatSnackBar,
    private _translate: TranslateService,) {

    this._archives = fs.readdirSync(this.data.pathBackup);
  }

  ngOnInit(): void {
    this.dataSource = this._setDataSource();
  }

  deleteArchive(index: number) {
    fs.unlinkSync(`${this.data.pathBackup}/${this._archives[index]}`);
    this._archives.splice(index, 1);
    this.dataSource = this._setDataSource();
    this._snackBar.open(this._translate.instant("PAGES.OPTIONS.RESTORE.BACKUP_REMOVED"), "", { duration: 2000 });
  }

  restoreBackup(index: number) {
    rimraf.sync(`${this.data.fullPath}/WTF.old`);
    rimraf.sync(`${this.data.fullPath}/Interface.old`);
    try {
      fs.renameSync(`${this.data.fullPath}/WTF`, `${this.data.fullPath}/WTF.old`);
      fs.renameSync(`${this.data.fullPath}/Interface`, `${this.data.fullPath}/Interface.old`);
      this._snackBar.open(this._translate.instant("PAGES.OPTIONS.RESTORE.RESTORE_STARTED"));

      setTimeout(() => {
        const zip = new AdmZip(`${this.data.pathBackup}/${this._archives[index]}`);
        zip.extractAllTo(this.data.fullPath);
        this._snackBar.dismiss();

        rimraf.sync(`${this.data.fullPath}/WTF.old`);
        rimraf.sync(`${this.data.fullPath}/Interface.old`);
      }, 1000);

    } catch {
      fs.renameSync(`${this.data.fullPath}/WTF.old`, `${this.data.fullPath}/WTF`);
      fs.renameSync(`${this.data.fullPath}/Interface.old`, `${this.data.fullPath}/Interface`);
    }
  }

  private _setDataSource() {
    return this._archives.map(arch => parseInt(arch.split('.')[0])).sort((a, b) => b - a).map((date) => moment(new Date(date)).format('L LT'));
  }

}
