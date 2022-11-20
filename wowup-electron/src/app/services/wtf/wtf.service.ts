import { Injectable } from "@angular/core";
import * as path from "path";
import { FsStats, WowInstallation } from "wowup-lib-core";

import { TreeNode } from "../../../common/models/ipc-events";
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

  /**
   * Prepare the backup folder, create some back metadata for the backup, zip the wtf contents into a zip file
   */
  public async createBackup(installation: WowInstallation, status?: (int) => void): Promise<void> {
    // ensure we have a directory to save our backup zip to
    await this.createBackupDirectory(installation);

    // delete any pre-existing meta file so it does not affect the overall hash
    await this.deleteBackupMetadataFile(installation);

    // create the hash output for the file tree
    const [metadataFilePath, metadataFile] = await this.createBackupMetadataFile(installation);

    status?.call(this, metadataFile.contents.length);

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

  /**
   * Use the given backup zip file to carefully replace the user's existing WTF folder with what was inside the backup zip
   * This operation should support a rollback feature up on failures
   */
  public async applyBackup(fileName: string, installation: WowInstallation): Promise<void> {
    console.time("applyBackup");
    try {
      if (!fileName.endsWith(".zip")) {
        throw new Error(`Invalid backup file: ${fileName}`);
      }

      const backupPath = this.getBackupPath(installation);
      const wtfPath = this.getWtfPath(installation);
      const fullPath = path.join(backupPath, fileName);

      console.log(`Check backup zip location: ${fullPath}`);
      const pathExists = await this._fileService.pathExists(fullPath);
      if (!pathExists) {
        throw new Error("path not found");
      }

      const wtfPathExists = await this._fileService.pathExists(wtfPath);
      const wtfBackupPath = `${wtfPath}-wowup`;
      if (wtfPathExists) {
        console.log(`Rename current wtf folder: ${wtfPath}`);
        await this._fileService.renameFile(wtfPath, wtfBackupPath);
      }

      console.log(`Unzip backup file: ${wtfPath}`);
      try {
        await this._fileService.unzipFile(fullPath, wtfPath);

        // remove the metadata file, so that hashes will match
        await this.deleteBackupMetadataFile(installation);

        // validate that what we unzipped matches what was expected
        console.log(`Validate backup result`);
        await this.isBackupApplicationValid(fullPath, installation);
      } catch (e) {
        // Roll back the changes we made
        console.log(`Rolling back changes`);
        await this._fileService.deleteIfExists(wtfPath);
        await this._fileService.renameFile(wtfBackupPath, wtfPath);
        throw e;
      }

      console.log(`Removing soft backup: ${wtfBackupPath}`);
      await this._fileService.deleteIfExists(wtfBackupPath);
    } finally {
      console.timeEnd("applyBackup");
    }
  }

  /**
   * Cross check the unzipped results against the metadata we have stored in the source zip file
   */
  private async isBackupApplicationValid(zipFile: string, installation: WowInstallation) {
    const srcMetaTxt = await this._fileService.readFileInZip(zipFile, BACKUP_META_FILENAME);

    const srcMeta: WtfBackupMetadataFile = JSON.parse(srcMetaTxt);
    let newMeta = await this.getBackupMetaList(installation);

    // since the metadata file is not considered when hashing the contents, ignore it
    srcMeta.contents = srcMeta.contents.filter((sm) => !sm.path.endsWith(BACKUP_META_FILENAME));
    newMeta = newMeta.filter((nm) => !nm.path.endsWith(BACKUP_META_FILENAME));

    if (srcMeta.contents.length !== newMeta.length) {
      throw new Error("Backup content count did not match");
    }

    for (const sm of srcMeta.contents) {
      const nm = newMeta.find((n) => n.path === sm.path);
      if (!nm) {
        console.warn(`Matching path not found" ${sm.path}`);
        continue;
      }

      if (nm.hash !== sm.hash) {
        console.warn(`Hash mismatch found: ${sm.path} : ${nm.path}`);
        continue;
      }
    }
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

  private async createBackupMetadataFile(installation: WowInstallation): Promise<[string, WtfBackupMetadataFile]> {
    const backupMetaList = await this.getBackupMetaList(installation);
    const backupMetadata: WtfBackupMetadataFile = {
      contents: backupMetaList,
      createdAt: Date.now(),
      createdBy: "manual",
    };

    return [await this.writeWtfMetadataFile(backupMetadata, installation), backupMetadata];
  }

  private async deleteBackupMetadataFile(installation: WowInstallation) {
    const wtfPath = this.getWtfPath(installation);
    const metaPath = path.join(wtfPath, BACKUP_META_FILENAME);
    await this._fileService.deleteIfExists(metaPath);
  }

  private async getBackupMetaList(installation: WowInstallation): Promise<WtfBackupMeta[]> {
    const wtfTree = await this.getWtfContents(installation, true);
    const wtfList = this.flattenTree([wtfTree]);

    return this.toBackupMeta(wtfList, installation);
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

  /**
   * Get a list of all the zip files in our internal backup folder
   */
  private async listBackupFiles(installation: WowInstallation) {
    const backupPath = this.getBackupPath(installation);
    const zipFiles = await this._fileService.listFiles(backupPath, "*.zip");
    return zipFiles.map((f) => path.join(backupPath, f));
  }

  /**
   * Get the path to our internal backup folder
   */
  public getBackupPath(installation: WowInstallation): string {
    return path.join(this._wowUpService.wtfBackupFolder, installation.id);
  }

  /**
   * Convert a tree structure to a flat array
   */
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
