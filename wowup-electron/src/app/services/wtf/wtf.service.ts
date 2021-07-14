import { Injectable } from "@angular/core";
import * as path from "path";

import { Addon } from "../../../common/entities/addon";
import { FsStats } from "../../../common/models/ipc-events";
import { WowInstallation } from "../../models/wowup/wow-installation";
import { FileService } from "../files/file.service";

const WTF_FOLDER = "WTF";
const ACCOUNT_FOLDER = "Account";
const SAVED_VARIABLES_FOLDER = "SavedVariables";

export interface FileStats {
  name: string;
  path: string;
  stats: FsStats;
}

@Injectable({
  providedIn: "root",
})
export class WtfService {
  public constructor(private _fileService: FileService) {}

  public getWtfPath(installation: WowInstallation): string {
    return path.join(path.dirname(installation.location), WTF_FOLDER);
  }

  public getAccountsPath(installation: WowInstallation): string {
    return path.join(this.getWtfPath(installation), ACCOUNT_FOLDER);
  }

  public async listAccountPaths(installations: WowInstallation): Promise<string[]> {
    return await this._fileService.listDirectories(this.getAccountsPath(installations));
  }

  public async getAccounts(installation: WowInstallation): Promise<string[]> {
    const accountFolders = await this.listAccountPaths(installation);
    return accountFolders.filter((folder) => folder !== SAVED_VARIABLES_FOLDER);
  }

  public async getServers(installation: WowInstallation, account: string): Promise<string[]> {
    const accountPath = path.join(this.getAccountsPath(installation), account);
    const entries = await this._fileService.listDirectories(accountPath);

    return entries.filter((entry) => entry !== SAVED_VARIABLES_FOLDER);
  }

  public async getCharacters(installation: WowInstallation, account: string, server: string): Promise<string[]> {
    const serverPath = path.join(this.getAccountsPath(installation), account, server);
    const entries = await this._fileService.listDirectories(serverPath);
    return entries;
  }

  public async getCharacterVariables(
    installation: WowInstallation,
    account: string,
    server: string,
    character: string
  ): Promise<FileStats[]> {
    try {
      const characterPath = path.join(
        this.getAccountsPath(installation),
        account,
        server,
        character,
        SAVED_VARIABLES_FOLDER
      );
      const entries = await this._fileService.listFiles(characterPath, "*.lua");

      const entryPaths = entries.map((entry) => path.join(characterPath, entry));
      const fileSizes = await this._fileService.statFiles(entryPaths);

      const fsStats: FileStats[] = Object.keys(fileSizes).map((key) => {
        return {
          name: path.basename(key),
          path: key,
          stats: fileSizes[key],
        };
      });

      return fsStats;
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  public async getGlobalVariables(installation: WowInstallation, account: string): Promise<FileStats[]> {
    const accountPath = path.join(this.getAccountsPath(installation), account, SAVED_VARIABLES_FOLDER);
    const entries = await this._fileService.listFiles(accountPath, "*.lua");

    const entryPaths = entries.map((entry) => path.join(accountPath, entry));
    const fileSizes = await this._fileService.statFiles(entryPaths);

    const fsStats: FileStats[] = Object.keys(fileSizes).map((key) => {
      return {
        name: path.basename(key),
        path: key,
        stats: fileSizes[key],
      };
    });

    return fsStats;
  }

  public async getGlobalSavedVariables(installation: WowInstallation): Promise<void> {}

  public async getMap(addon: Addon): Promise<void> {}
}
