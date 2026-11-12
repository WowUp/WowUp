import * as _ from "lodash";
import { basename, join } from "path";
import {
  Addon,
  AddonChannelType,
  AddonProvider,
  AddonSearchResult,
  AddonSearchResultFile,
  SearchByUrlResult,
  Toc,
  WowInstallation,
} from "wowup-lib-core";

import { ADDON_PROVIDER_ZIP } from "../../../src/common/constants";

const VALID_ZIP_CONTENT_TYPES = ["application/zip", "application/x-zip-compressed", "application/octet-stream"];

export interface ZipProviderDeps {
  /** The response headers for a HEAD request to the url */
  head: (url: URL) => Promise<Headers>;
  getAddonFolderPath: (installation: WowInstallation) => string;
  /** Names of the `.toc` files directly in the folder, none if it's missing */
  listTocFiles: (dirPath: string) => Promise<string[]>;
  parseToc: (tocPath: string) => Promise<Toc>;
}

/** Installs an addon from a direct link to its zip. There's no source to update from, so it's always ignored. */
export class ZipAddonProvider extends AddonProvider {
  public readonly name = ADDON_PROVIDER_ZIP;
  public readonly forceIgnore = true;
  public readonly allowReinstall = false;
  public readonly allowChannelChange = false;
  public readonly allowEdit = false;
  public readonly allowReScan = false;
  public readonly canShowChangelog = false;
  public enabled = true;

  public constructor(private readonly _deps: ZipProviderDeps) {
    super();
  }

  public isValidAddonUri(addonUri: URL): boolean {
    return addonUri.pathname?.toLowerCase()?.endsWith(".zip");
  }

  public isValidAddonId(): boolean {
    return false;
  }

  public async getDescription(installation: WowInstallation, externalId: string, addon?: Addon): Promise<string> {
    if (!addon) {
      return "";
    }

    const folders = addon?.installedFolderList ?? [];
    const clientAddonFolderPath = this._deps.getAddonFolderPath(installation);
    const allTocs = await this.getAllTocs(clientAddonFolderPath, folders);

    const primaryToc = _.maxBy(allTocs, (toc) => Object.values(toc).join("").length);
    if (!primaryToc) {
      return "";
    }

    return _.map(Object.entries(primaryToc), ([key, value]) => {
      if (typeof value === "string" && !!value) {
        return `${key}: ${value}`;
      }
      return "";
    })
      .filter((str) => !!str)
      .map((str) => `<p>${str}</p>`)
      .join("");
  }

  private async getAllTocs(baseDir: string, installedFolders: string[]) {
    const tocs: Toc[] = [];

    for (const dir of installedFolders) {
      const dirPath = join(baseDir, dir);

      const tocFile = _.first(await this._deps.listTocFiles(dirPath));
      if (!tocFile) {
        continue;
      }

      const toc = await this._deps.parseToc(join(dirPath, tocFile));
      if (!toc.interface) {
        continue;
      }

      tocs.push(toc);
    }

    return tocs;
  }

  public async searchByUrl(addonUri: URL): Promise<SearchByUrlResult> {
    if (!addonUri.pathname.toLowerCase().endsWith(".zip")) {
      throw new Error(`Invalid zip URL ${addonUri.toString()}`);
    }

    await this.validateUrlContentType(addonUri);

    const fileName = _.last(addonUri.pathname.split("/")) ?? "unknown";
    const fileNameNoExt = basename(fileName, ".zip");

    const potentialFile: AddonSearchResultFile = {
      channelType: AddonChannelType.Stable,
      downloadUrl: addonUri.toString(),
      folders: [fileNameNoExt],
      gameVersion: "",
      version: fileNameNoExt,
      releaseDate: new Date(),
      changelog: "",
    };

    const potentialAddon: AddonSearchResult = {
      author: addonUri.hostname,
      downloadCount: 1,
      externalId: addonUri.toString(),
      externalUrl: addonUri.origin,
      name: fileName,
      providerName: this.name,
      thumbnailUrl: "",
      files: [potentialFile],
    };

    return {
      errors: [],
      searchResult: potentialAddon,
    };
  }

  public override async getById(addonId: string): Promise<AddonSearchResult | undefined> {
    const addonUri = new URL(addonId);

    if (!addonUri.pathname.toLowerCase().endsWith(".zip")) {
      throw new Error(`Invalid zip URL ${addonUri.toString()}`);
    }

    await this.validateUrlContentType(addonUri);

    const fileName = _.last(addonUri.pathname.split("/")) ?? "unknown";

    const searchResultFile: AddonSearchResultFile = {
      channelType: AddonChannelType.Stable,
      downloadUrl: addonUri.toString(),
      folders: [],
      gameVersion: "",
      version: fileName,
      releaseDate: new Date(),
    };

    return {
      author: "",
      downloadCount: 1,
      externalId: addonUri.toString(),
      externalUrl: addonUri.origin,
      name: fileName,
      providerName: this.name,
      thumbnailUrl: "",
      files: [searchResultFile],
    };
  }

  private async validateUrlContentType(addonUri: URL) {
    const headers = await this._deps.head(addonUri);
    const contentType = headers.get("content-type") ?? "";
    if (!VALID_ZIP_CONTENT_TYPES.includes(contentType)) {
      throw new Error(`Invalid zip content type ${contentType}`);
    }
  }
}
