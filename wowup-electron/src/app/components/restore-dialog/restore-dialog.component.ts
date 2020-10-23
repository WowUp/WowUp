import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as fs from 'fs';
import * as moment from 'moment';

@Component( {
  selector: 'app-restore-dialog',
  templateUrl: './restore-dialog.component.html',
  styleUrls: ['./restore-dialog.component.scss']
} )
export class RestoreDialogComponent implements OnInit {
  displayedColumns: string[] = ['Date', 'Restore', 'Delete'];
  dataSource: string[];

  private _fullPath: string;
  private _archives: string[];
  constructor( public dialogRef: MatDialogRef<RestoreDialogComponent>,
    @Inject( MAT_DIALOG_DATA ) public data: string, private _snackBar: MatSnackBar, ) {
    this._fullPath = this.data;
    this._archives = fs.readdirSync( this.data );
  }

  ngOnInit(): void {
    this.dataSource = this._setDataSource();
  }

  deleteArchive( index: number ) {
    fs.unlinkSync( `${this._fullPath}/${this._archives[index]}` );
    this._archives.splice( index, 1 );
    this.dataSource = this._setDataSource();
    this._snackBar.open( "PAGES.OPTIONS.WOW.BACKUP_REMOVED", "", { duration: 2000 } );
  }

  private _setDataSource() {
    return this._archives.map( arch => arch.split( '.' )[0] ).map( ( date ) => moment( new Date( parseInt( date ) ) ).format( 'L LT' ) );
  }

}
