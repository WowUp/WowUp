import { Injectable } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import * as fs from "fs";
import * as JSZip from "jszip";
import * as path from "path";
import { Subject } from "rxjs";
import { InstalledProduct } from "../../models/warcraft/installed-product";
import { WowUpService } from "./wowup.service";

@Injectable({
  providedIn: "root",
})
export class WowUpBackupAddonService {
  public backupFolderName = ".wowup_backup";
  public clients: InstalledProduct[] = [];
  public progressAction$: Subject<number> = new Subject();

  private _interval: NodeJS.Timeout = null;
  private get _backgroundBackup(): boolean {
    return this._wowUpService.enabledBackup && this._wowUpService.enabledAutomaticBackup;
  }

  public constructor(private _wowUpService: WowUpService, private _translateService: TranslateService) {}

  public async backup(dateBackup: number): Promise<string> {
    let error = "";
    let progressBar = 0;
    const progressInterval = setInterval(() => {
      progressBar = progressBar + 2;
      this.progressAction$.next(progressBar);
    }, 1000);

    for (const { location, name } of this.clients) {
      const wtfPath = `${location}/WTF`;
      const interfacePath = `${location}/Interface`;
      if (fs.existsSync(wtfPath) && fs.existsSync(interfacePath)) {
        try {
          const zip = new JSZip();
          this._buildZipFromDirectory(wtfPath, zip, location);
          this._buildZipFromDirectory(interfacePath, zip, location);

          const zipContent = await zip.generateAsync({
            type: "nodebuffer",
            comment: "wowup.io",
            compression: "DEFLATE",
            compressionOptions: {
              level: 4,
            },
          });

          const pathBackup = `${location}/${this.backupFolderName}`;
          if (!this.getBackupFolderExist(location)) {
            fs.mkdirSync(pathBackup);
          }

          const backupFiles = fs.readdirSync(pathBackup).sort((a, b) => {
            return this._getDateBackup(b).getTime() - this._getDateBackup(a).getTime();
          });

          const backupsToDelete: string[] = backupFiles.splice(9, backupFiles.length - 1);

          backupsToDelete.forEach((backup) => {
            this.deleteBackup(location, backup);
          });

          fs.writeFileSync(`${pathBackup}/${dateBackup}.zip`, zipContent);
        } catch {
          error += this._translateService.instant("PAGES.OPTIONS.BACKUP.ERROR_UNDEFINED", {
            client: name,
          });
        }
      } else {
        error += this._translateService.instant("PAGES.OPTIONS.BACKUP.ERROR_FOLDER_NOT_FOUND", {
          client: name,
        });
      }
    }
    clearInterval(progressInterval);
    this.progressAction$.next(100);
    this._wowUpService.setLastBackupDate(dateBackup);
    return error;
  }

  public async restore(filePath: string, path: string): Promise<string> {
    let error = "";
    let progressBar = 0;
    const progressInterval = setInterval(() => {
      progressBar = progressBar + 2;
      this.progressAction$.next(progressBar);
    }, 1000);
    const wtfPath = `${path}/WTF`;
    const interfacePath = `${path}/Interface`;

    this._renameFolder(wtfPath, true);
    this._renameFolder(interfacePath, true);

    try {
      const data = fs.readFileSync(filePath);

      const { files } = await JSZip.loadAsync(data);

      for (const filename in files) {
        const pathRestore = `${path}/${filename}`;
        const content = await files[filename].async("string");

        if (!content) {
          fs.mkdirSync(pathRestore);
        } else {
          fs.writeFileSync(pathRestore, content);
        }
      }
    } catch {
      error += this._translateService.instant("PAGES.OPTIONS.BACKUP.ERROR_RESTORE");

      this._renameFolder(wtfPath, false);
      this._renameFolder(interfacePath, false);
    } finally {
      fs.rmdirSync(`${wtfPath}.old`, { recursive: true });
      fs.rmdirSync(`${interfacePath}.old`, { recursive: true });
      clearInterval(progressInterval);
      this.progressAction$.next(100);
    }
    return error;
  }

  public async startBackgroundBackup(): Promise<void> {
    if (!this._backgroundBackup) {
      return;
    }

    const dateBackup = Date.now();
    const oneDayTime = 1000 * 3600 * 24;

    const last = (dateBackup - this._wowUpService.lastBackupDate) / oneDayTime;
    if (last >= 1) {
      await this.backup(dateBackup);
    }

    if (!this._interval) {
      this._interval = setInterval(() => {
        void this.backup(dateBackup);
      }, oneDayTime);
    }
  }

  public stopBackgroundBackup(): void {
    clearInterval(this._interval);
    this._interval = null;
  }

  public deleteBackup(path: string, file: string): void {
    fs.unlinkSync(`${path}/${this.backupFolderName}/${file}`);
  }

  public getBackupFolderExist(path: string): boolean {
    return fs.existsSync(`${path}/${this.backupFolderName}`);
  }

  public getBackupFiles(path: string): string[] {
    return fs.readdirSync(`${path}/${this.backupFolderName}`);
  }

  private _renameFolder(path: string, toOld: boolean): void {
    if (toOld && fs.existsSync(`${path}`)) {
      fs.renameSync(path, `${path}.old`);
    } else if (!toOld && fs.existsSync(`${path}.old`)) {
      fs.renameSync(`${path}.old`, path);
    }
  }

  private _getDateBackup(file: string): Date {
    return new Date(Number(file.replace("zip", "")));
  }
  private _buildZipFromDirectory(dir: string, zip: JSZip, root: string): void {
    const list = fs.readdirSync(dir);

    for (const file of list) {
      const filePath = path.resolve(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        this._buildZipFromDirectory(filePath, zip, root);
      } else {
        const fileData = fs.readFileSync(filePath);
        zip.file(filePath.replace(root, ""), fileData);
      }
    }
  }
}
