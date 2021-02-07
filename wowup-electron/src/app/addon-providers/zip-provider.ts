import * as _ from "lodash";
import { join } from "path";
import { from, Observable } from "rxjs";
import { map } from "rxjs/operators";

import { HttpClient } from "@angular/common/http";

import { ADDON_PROVIDER_ZIP } from "../../common/constants";
import { Addon } from "../entities/addon";
import { WowClientType } from "../models/warcraft/wow-client-type";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";
import { Toc } from "../models/wowup/toc";
import { FileService } from "../services/files/file.service";
import { TocService } from "../services/toc/toc.service";
import { WarcraftService } from "../services/warcraft/warcraft.service";
import { AddonProvider } from "./addon-provider";

const VALID_ZIP_CONTENT_TYPES = ["application/zip", "application/x-zip-compressed", "application/octet-stream"];

export class ZipAddonProvider extends AddonProvider {
  public readonly name = ADDON_PROVIDER_ZIP;
  public readonly forceIgnore = true;
  public readonly allowReinstall = false;
  public readonly allowChannelChange = false;
  public readonly allowEdit = false;
  public readonly canShowChangelog = false;
  public enabled = true;

  constructor(
    private _httpClient: HttpClient,
    private _fileService: FileService,
    private _tocService: TocService,
    private _warcraftService: WarcraftService
  ) {
    super();
  }

  isValidAddonUri(addonUri: URL): boolean {
    return addonUri.pathname?.toLowerCase()?.endsWith(".zip");
  }

  isValidAddonId(addonId: string): boolean {
    return false;
  }

  async getDescription(clientType: WowClientType, externalId: string, addon?: Addon): Promise<string> {
    if (!addon) {
      return "";
    }

    const folders = addon.installedFolderList;
    const clientAddonFolderPath = this._warcraftService.getAddonFolderPath(addon.clientType);
    const allTocs = await this.getAllTocs(clientAddonFolderPath, folders);

    const primaryToc = this.getPrimaryToc(allTocs);
    const lines = _.map(Object.entries(primaryToc), ([key, value]) => {
      if (typeof value === "string" && !!value) {
        return `${key}: ${value}`;
      }
      return "";
    })
      .filter((str) => !!str)
      .map((str) => `<p>${str}</p>`)
      .join("");

    return lines;
  }

  private getPrimaryToc(tocs: Toc[]) {
    return _.maxBy(tocs, (toc) => Object.values(toc).join("").length);
  }

  private async getAllTocs(baseDir: string, installedFolders: string[]) {
    const tocs: Toc[] = [];

    for (const dir of installedFolders) {
      const dirPath = join(baseDir, dir);

      const tocFiles = await this._fileService.listFiles(dirPath, "*.toc");
      const tocFile = _.first(tocFiles);
      if (!tocFile) {
        continue;
      }

      const tocPath = join(dirPath, tocFile);
      const toc = await this._tocService.parse(tocPath);
      if (!toc.interface) {
        continue;
      }

      tocs.push(toc);
    }

    return tocs;
  }

  async searchByUrl(addonUri: URL, clientType: WowClientType): Promise<AddonSearchResult | undefined> {
    if (!addonUri.pathname.toLowerCase().endsWith(".zip")) {
      throw new Error(`Invalid zip URL ${addonUri.toString()}`);
    }

    await this.validateUrlContentType(addonUri);

    const fileName = _.last(addonUri.pathname.split("/"));

    const potentialAddon: AddonSearchResult = {
      author: addonUri.hostname,
      downloadCount: 1,
      externalId: addonUri.toString(),
      externalUrl: addonUri.origin,
      name: fileName,
      providerName: this.name,
      thumbnailUrl: "",
    };

    return potentialAddon;
  }

  getById(addonId: string, clientType: WowClientType): Observable<AddonSearchResult> {
    const addonUri = new URL(addonId);

    if (!addonUri.pathname.toLowerCase().endsWith(".zip")) {
      throw new Error(`Invalid zip URL ${addonUri.toString()}`);
    }

    return from(this.validateUrlContentType(addonUri)).pipe(
      map(() => {
        const fileName = _.last(addonUri.pathname.split("/"));

        const searchResultFile: AddonSearchResultFile = {
          channelType: AddonChannelType.Stable,
          downloadUrl: addonUri.toString(),
          folders: [],
          gameVersion: "",
          version: fileName,
          releaseDate: new Date(),
        };

        const potentialAddon: AddonSearchResult = {
          author: "",
          downloadCount: 1,
          externalId: addonUri.toString(),
          externalUrl: addonUri.origin,
          name: fileName,
          providerName: this.name,
          thumbnailUrl: "",
          files: [searchResultFile],
        };

        return potentialAddon;
      })
    );
  }

  private async validateUrlContentType(addonUri: URL) {
    const response = await this.getUrlInfo(addonUri);
    const contentType = response.headers.get("content-type");
    if (!VALID_ZIP_CONTENT_TYPES.includes(contentType)) {
      throw new Error(`Invalid zip content type ${contentType}`);
    }
  }

  private getUrlInfo(addonUri: URL) {
    return this._httpClient.head(addonUri.toString(), { observe: "response", responseType: "text" }).toPromise();
  }
}
