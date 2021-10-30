import { Injectable } from "@angular/core";
import * as path from "path";

import { FsStats, TreeNode } from "../../../common/models/ipc-events";
import { WowInstallation } from "../../../common/warcraft/wow-installation";
import { FileService } from "../files/file.service";
import { WowUpService } from "../wowup/wowup.service";

const WTF_FOLDER = "WTF";
const ACCOUNT_FOLDER = "Account";
const SAVED_VARIABLES_FOLDER = "SavedVariables";
const BACKUP_META_FILENAME = "wowup-meta.json";

export interface FileStats {
  name: string;
  path: string;
  stats: FsStats;
}

export interface WtfEntry {
  name: string;
  children: WtfEntry[];
}

export interface WtfNode extends TreeNode {
  isLua: boolean;
  ignore: boolean;
  children: WtfNode[];
}

export interface WtfBackupMetadataFile {
  createdBy: string;
  createdAt: number;
  contents: WtfBackupMeta[];
}

export interface WtfBackupMeta {
  path: string;
  isDirectory: boolean;
  size: number;
  hash: string;
}

export interface WtfBackup {
  location: string;
  fileName: string;
  size: number;
  birthtimeMs: number;
  error?: string;
  metadata?: WtfBackupMetadataFile;
}

@Injectable({
  providedIn: "root",
})
export class WtfService {
  public constructor(private _fileService: FileService, private _wowUpService: WowUpService) {}

  /**
   * Get a nested tree of nodes for every file within the WTF structure
   * including the hash will make this operation much slower
   */
  public async getWtfContents(installation: WowInstallation, includeHash = false): Promise<WtfNode> {
    console.time("getWtfContents");
    try {
      const wtfPath = this.getWtfPath(installation);
      const tree = await this._fileService.getDirectoryTree(wtfPath, { includeHash });
      return this.getWtfNode(tree);
    } finally {
      console.timeEnd("getWtfContents");
    }
  }

  public getWtfNode(treeNode: TreeNode): WtfNode {
    const wtfNode: WtfNode = {
      ...treeNode,
      isLua: path.extname(treeNode.name) === ".lua",
      ignore: this.shouldIgnoreFile(treeNode.name),
      children: treeNode.children.map((tn) => this.getWtfNode(tn)),
    };

    return wtfNode;
  }

  private shouldIgnoreFile(fileName: string): boolean {
    const canonName = fileName.toLowerCase();
    return canonName.endsWith(".lua.bak") || canonName.startsWith("blizzard_");
  }

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

  public async getBackupList(installation: WowInstallation): Promise<WtfBackup[]> {
    console.time("getBackupList");
    try {
      const wtfBackups: WtfBackup[] = [];

      const backupZipFiles = await this.listBackupFiles(installation);
      const fsStats = await this._fileService.statFiles(backupZipFiles);

      for (let i = 0; i < backupZipFiles.length; i++) {
        const zipFile = backupZipFiles[i];
        const stat = fsStats[zipFile];

        const wtfBackup: WtfBackup = {
          location: zipFile,
          fileName: path.basename(zipFile),
          size: stat.size,
          birthtimeMs: stat.birthtimeMs,
        };

        try {
          const zipMetaTxt = await this._fileService.readFileInZip(zipFile, BACKUP_META_FILENAME);
          const zipMetaData: WtfBackupMetadataFile = JSON.parse(zipMetaTxt);

          if (!Array.isArray(zipMetaData.contents)) {
            wtfBackup.error = "INVALID_CONTENTS";
          } else if (typeof zipMetaData.createdAt !== "number") {
            wtfBackup.error = "INVALID_CREATED_AT";
          } else if (typeof zipMetaData.createdBy !== "string") {
            wtfBackup.error = "INVALID_CREATED_BY";
          }
        } catch (e) {
          console.error("Failed to process backup metadata", zipFile, e);
          wtfBackup.error = "GENERIC_ERROR";
        } finally {
          wtfBackups.push(wtfBackup);
        }
      }

      return wtfBackups;
    } finally {
      console.timeEnd("getBackupList");
    }
  }

  public async createBackup(installation: WowInstallation): Promise<void> {
    await this.createBackupDirectory(installation);

    const metadataFilePath = await this.createBackupMetadataFile(installation);

    try {
      await this.createBackupZip(installation);
    } finally {
      // always delete the metadata file
      await this._fileService.remove(metadataFilePath);
    }
  }

  /**
   * Delete a backup zip file based on the given installation
   */
  public async deleteBackup(fileName: string, installation: WowInstallation): Promise<void> {
    const backupPath = this.getBackupPath(installation);
    const fullPath = path.join(backupPath, fileName);

    const pathExists = await this._fileService.pathExists(fullPath);
    if (!pathExists) {
      throw new Error("path not found");
    }

    await this._fileService.remove(fullPath);
  }

  private async createBackupZip(installation: WowInstallation): Promise<void> {
    console.time("createBackupZip");
    try {
      const wtfPath = this.getWtfPath(installation);
      const zipPath = path.join(this.getBackupPath(installation), `wtf_${Date.now()}.zip`);
      await this._fileService.zipFile(wtfPath, zipPath);
    } finally {
      console.timeEnd("createBackupZip");
    }
  }

  private async createBackupDirectory(installation: WowInstallation): Promise<void> {
    const backupPath = this.getBackupPath(installation);
    await this._fileService.createDirectory(backupPath);
  }

  private async createBackupMetadataFile(installation: WowInstallation): Promise<string> {
    const wtfTree = await this.getWtfContents(installation, true);
    const wtfList = this.flattenTree([wtfTree]);

    const backupMetadata: WtfBackupMetadataFile = {
      contents: this.toBackupMeta(wtfList, installation),
      createdAt: Date.now(),
      createdBy: "manual",
    };

    return await this.writeWtfMetadataFile(backupMetadata, installation);
  }

  private async writeWtfMetadataFile(
    backupMetadata: WtfBackupMetadataFile,
    installation: WowInstallation
  ): Promise<string> {
    const wtfPath = this.getWtfPath(installation);

    const metaPath = path.join(wtfPath, BACKUP_META_FILENAME);
    await this._fileService.writeFile(metaPath, JSON.stringify(backupMetadata, null, 2));

    return metaPath;
  }

  private async listBackupFiles(installation: WowInstallation) {
    const backupPath = this.getBackupPath(installation);
    const zipFiles = await this._fileService.listFiles(backupPath, "*.zip");
    return zipFiles.map((f) => path.join(backupPath, f));
  }

  public getBackupPath(installation: WowInstallation): string {
    return path.join(this._wowUpService.wtfBackupFolder, installation.id);
  }

  private flattenTree(nodes: WtfNode[]): WtfNode[] {
    return Array.prototype.concat.apply(
      nodes,
      nodes.map((n) => this.flattenTree(n.children))
    );
  }

  private toBackupMeta(nodes: WtfNode[], installation: WowInstallation): WtfBackupMeta[] {
    const wtfPath = this.getWtfPath(installation);

    return nodes.map((n) => {
      const nodeBase = n.path.replace(wtfPath, "");
      return {
        hash: n.hash,
        isDirectory: n.isDirectory,
        path: nodeBase,
        size: n.size,
      };
    });
  }
}
