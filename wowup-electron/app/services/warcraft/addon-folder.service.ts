import * as log from "electron-log/main";
import * as fsp from "fs/promises";
import * as path from "path";
import { AddonFolder, Toc, WowInstallation } from "wowup-lib-core";

import { WOW_ADDON_FOLDER_NAME, WOW_INTERFACE_FOLDER_NAME } from "../../../src/common/constants";
import { exists } from "../../file.utils";
import { FileSystemService } from "../files/file-system.service";
import { TocService } from "../toc/toc.service";

/** An installation's addon folders on disk, each with its parsed tocs */
export class AddonFolderService {
  public constructor(
    private readonly tocService: TocService,
    private readonly fileSystem: FileSystemService,
  ) {}

  /** Same rule as the renderer's WarcraftService.getAddonFolderPath */
  public getAddonFolderPath(installation: WowInstallation): string {
    return path.join(path.dirname(installation.location), WOW_INTERFACE_FOLDER_NAME, WOW_ADDON_FOLDER_NAME);
  }

  public async listAddons(addonFolderPath: string, scanSymlinks = false): Promise<AddonFolder[]> {
    const addonFolders: AddonFolder[] = [];

    const addonFolderExists = await exists(addonFolderPath);
    if (!addonFolderExists) {
      return addonFolders;
    }

    const directories = await this.fileSystem.listDirectories(addonFolderPath, scanSymlinks);

    for (const dir of directories) {
      const addonFolder = await this.getAddonFolder(addonFolderPath, dir);
      if (!addonFolder) {
        log.warn(`Failed to get addonFolder, no toc found: ${dir}`);
        continue;
      }

      addonFolder.fileStats = await this.fileSystem.statPath(path.join(addonFolderPath, dir));
      addonFolders.push(addonFolder);
    }

    return addonFolders;
  }

  public async getAddonFolder(addonFolderPath: string, dir: string): Promise<AddonFolder | undefined> {
    try {
      const dirPath = path.join(addonFolderPath, dir);
      const dirFiles = await fsp.readdir(dirPath);
      const tocFiles = dirFiles.filter((f) => path.extname(f) === ".toc");
      if (tocFiles.length === 0) {
        return undefined;
      }

      const tocs: Toc[] = [];
      for (const tocFile of tocFiles) {
        const tocPath = path.join(dirPath, tocFile);
        const toc = await this.tocService.parse(tocPath);
        tocs.push(toc);
      }

      return {
        name: dir,
        path: dirPath,
        status: "Pending",
        tocs,
      };
    } catch (e) {
      log.error(e);
      return undefined;
    }
  }
}
