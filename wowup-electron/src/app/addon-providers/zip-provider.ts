import * as _ from "lodash";
import { from, Observable } from "rxjs";
import { map } from "rxjs/operators";

import { HttpClient } from "@angular/common/http";

import { ADDON_PROVIDER_ZIP } from "../../common/constants";
import { WowClientType } from "../models/warcraft/wow-client-type";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";
import { AddonProvider } from "./addon-provider";

const VALID_ZIP_CONTENT_TYPES = ["application/zip", "application/x-zip-compressed"];

export class ZipAddonProvider extends AddonProvider {
  public readonly name = ADDON_PROVIDER_ZIP;
  public readonly forceIgnore = true;
  public readonly allowReinstall = false;
  public readonly allowChannelChange = false;
  public readonly allowEdit = false;
  public readonly canShowChangelog = false;
  public enabled = true;

  constructor(private _httpClient: HttpClient) {
    super();
  }

  isValidAddonUri(addonUri: URL): boolean {
    return addonUri.pathname?.toLowerCase()?.endsWith(".zip");
  }

  isValidAddonId(addonId: string): boolean {
    return false;
  }

  async searchByUrl(addonUri: URL, clientType: WowClientType): Promise<AddonSearchResult | undefined> {
    if (!addonUri.pathname.toLowerCase().endsWith(".zip")) {
      throw new Error(`Invalid zip URL ${addonUri}`);
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
      throw new Error(`Invalid zip URL ${addonUri}`);
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
