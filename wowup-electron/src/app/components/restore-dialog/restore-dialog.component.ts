import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import * as fs from 'fs';
import * as moment from 'moment';
import { UserBackupService } from '../../services/user-backup/user-backup.service';
@Component( {
  selector: 'app-restore-dialog',
  templateUrl: './restore-dialog.component.html',
  styleUrls: ['./restore-dialog.component.scss']
} )
export class RestoreDialogComponent implements OnInit {
  displayedColumns: string[] = ['Date', 'Restore', 'Delete'];
  dataSource: string[];
  disabledRestore: boolean
  disabledRemove: boolean
  private _archives: string[];

  constructor( public dialogRef: MatDialogRef<RestoreDialogComponent>,
    @Inject( MAT_DIALOG_DATA ) public data: { pathBackup: string, fullPath: string },
    private _snackBar: MatSnackBar,
    private _translate: TranslateService,
    private _userBackupService: UserBackupService ) {

    this._archives = fs.readdirSync( this.data.pathBackup );
    this.disabledRemove = false;
    this.disabledRestore = false
  }

  ngOnInit(): void {
    this.dataSource = this._setDataSource();
  }

  onDeleteArchive( index: number ) {
    this.disabledRemove = true;
    this.disabledRestore = true
    this._userBackupService.onDeleteArchive( `${this.data.pathBackup}/${this._archives[index]}` )
    this._archives.splice( index, 1 );
    this.dataSource = this._setDataSource();
    this._snackBar.open( this._translate.instant( "PAGES.OPTIONS.RESTORE.BACKUP_REMOVED" ), "", { duration: 2000 } );
    this.disabledRemove = false;
    this.disabledRestore = false
  }

  onRestoreBackup( index: number ) {
    this._snackBar.open( this._translate.instant( "PAGES.OPTIONS.RESTORE.RESTORE_STARTED" ) );
    this.disabledRemove = true;
    this.disabledRestore = true
    setTimeout( () => {
      this._userBackupService.onRestoreBackup( this.data.fullPath, `${this.data.pathBackup}/${this._archives[index]}` )
      this._snackBar.dismiss();
      this.disabledRemove = false;
      this.disabledRestore = false
    }, 1000 );

  }

  private _setDataSource() {
    return this._archives.map( arch => parseInt( arch.split( '.' )[0] ) ).sort( ( a, b ) => b - a ).map( ( date ) => moment( new Date( date ) ).format( 'L LT' ) );
  }

}
