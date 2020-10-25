import { Injectable } from '@angular/core';
import * as AdmZip from "adm-zip";
import * as fs from 'fs';
import * as rimraf from 'rimraf';
@Injectable( {
  providedIn: 'root'
} )
export class UserBackupService {

  constructor() { }

  onCreateBackup( fullPath: string, pathBackup: string ): void {
    if ( !fs.existsSync( pathBackup ) ) {
      fs.mkdirSync( pathBackup )
    };

    const zip = new AdmZip();
    zip.addLocalFolder( `${fullPath}/WTF`, 'WTF' );
    zip.addLocalFolder( `${fullPath}/Interface`, 'Interface' );
    zip.writeZip( `${pathBackup}/${Date.now()}.zip` );
  }

  onDeleteArchive( pathArchive: string ) {
    fs.unlinkSync( pathArchive );
  }

  checkPresenceBackups( pathBackup: string ): boolean {
    return !fs.existsSync( pathBackup ) || fs.readdirSync( pathBackup ).length === 0;
  }

  onRestoreBackup( fullPath: string, pathArchive: string ) {
    rimraf.sync( `${fullPath}/WTF.old` );
    rimraf.sync( `${fullPath}/Interface.old` );
    try {
      fs.renameSync( `${fullPath}/WTF`, `${fullPath}/WTF.old` );
      fs.renameSync( `${fullPath}/Interface`, `${fullPath}/Interface.old` );

      const zip = new AdmZip( pathArchive );
      zip.extractAllTo( fullPath );
      rimraf.sync( `${fullPath}/WTF.old` );
      rimraf.sync( `${fullPath}/Interface.old` );
    } catch {
      rimraf.sync( `${fullPath}/WTF` );
      rimraf.sync( `${fullPath}/Interface` );
      fs.renameSync( `${fullPath}/WTF.old`, `${fullPath}/WTF` );
      fs.renameSync( `${fullPath}/Interface.old`, `${fullPath}/Interface` );


    }
  }
}
