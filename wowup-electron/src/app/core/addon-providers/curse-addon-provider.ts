import { AddonProvider } from "./addon-provider";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { Addon } from "../entities/addon";
import { HttpClient } from "@angular/common/http";
import { CurseSearchResult } from "app/models/curse/curse-search-result";
import { map } from "rxjs/operators";
import { CurseFile } from "app/models/curse/curse-file";
import * as _ from 'lodash';
import { AddonSearchResult } from "app/models/wowup/addon-search-result";
import { Observable } from "rxjs";
import { AddonSearchResultFile } from "app/models/wowup/addon-search-result-file";
import { CurseReleaseType } from "app/models/curse/curse-release-type";
import { AddonChannelType } from "app/models/wowup/addon-channel-type";

const API_URL = "https://addons-ecs.forgesvc.net/api/v2";

export class CurseAddonProvider implements AddonProvider {

    private readonly _httpClient: HttpClient;

    public readonly name = "Curse";

    constructor(httpClient: HttpClient) {
        this._httpClient = httpClient;
    }

    getAll(clientType: WowClientType, addonIds: string[]): Promise<import("../../models/wowup/addon-search-result").AddonSearchResult[]> {
        throw new Error("Method not implemented.");
    }

    getFeaturedAddons(clientType: WowClientType): Promise<import("../../models/wowup/potential-addon").PotentialAddon[]> {
        throw new Error("Method not implemented.");
    }

    searchByQuery(query: string, clientType: WowClientType): Promise<import("../../models/wowup/potential-addon").PotentialAddon[]> {
        throw new Error("Method not implemented.");
    }

    searchByUrl(addonUri: URL, clientType: WowClientType): Promise<import("../../models/wowup/potential-addon").PotentialAddon> {
        throw new Error("Method not implemented.");
    }

    searchByName(addonName: string, folderName: string, clientType: WowClientType, nameOverride?: string): Promise<import("../../models/wowup/addon-search-result").AddonSearchResult[]> {
        throw new Error("Method not implemented.");
    }

    getById(addonId: string, clientType: WowClientType): Promise<AddonSearchResult> {
        const url = `${API_URL}/addon/${addonId}`;

        return this._httpClient.get<CurseSearchResult>(url)
            .pipe(
                map(result => {
                    if (!result) {
                        return null;
                    }

                    const latestFiles = this.getLatestFiles(result, clientType);
                    if (!latestFiles?.length) {
                        return null;
                    }

                    return this.getAddonSearchResult(result, latestFiles);
                })
            )
            .toPromise();
    }

    isValidAddonUri(addonUri: URL): boolean {
        throw new Error("Method not implemented.");
    }

    onPostInstall(addon: Addon): void {
        throw new Error("Method not implemented.");
    }

    private getAddonSearchResult(result: CurseSearchResult, latestFiles: CurseFile[]): AddonSearchResult {
        try {
            var thumbnailUrl = this.getThumbnailUrl(result);
            var id = result.id;
            var name = result.name;
            var author = this.getAuthor(result);

            var searchResultFiles: AddonSearchResultFile[] = latestFiles.map(lf => {
                return {
                    channelType: this.getChannelType(lf.releaseType),
                    version: lf.fileName,
                    downloadUrl: lf.downloadUrl,
                    folders: this.getFolderNames(lf),
                    gameVersion: this.getGameVersion(lf)
                };
            });

            var searchResult: AddonSearchResult = {
                author,
                externalId: id.toString(),
                name,
                thumbnailUrl,
                externalUrl: result.websiteUrl,
                providerName: this.name,
                files: searchResultFiles
            };

            return searchResult;
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    private getChannelType(releaseType: CurseReleaseType): AddonChannelType {
        switch (releaseType) {
            case CurseReleaseType.Alpha:
                return AddonChannelType.Alpha;
            case CurseReleaseType.Beta:
                return AddonChannelType.Beta;
            case CurseReleaseType.Release:
            default:
                return AddonChannelType.Stable;
        }
    }

    private getFolderNames(file: CurseFile): string[] {
        return file.modules.map(m => m.foldername);
    }

    private getGameVersion(file: CurseFile): string {
        return _.first(file.gameVersion);
    }

    private getAuthor(result: CurseSearchResult): string {
        var authorNames = result.authors.map(a => a.name);
        return authorNames.join(', ');
    }

    private getThumbnailUrl(result: CurseSearchResult): string {
        const attachment = _.find(result.attachments, f => f.isDefault && !!f.thumbnailUrl);
        return attachment?.thumbnailUrl;
    }

    private getLatestFiles(result: CurseSearchResult, clientType: WowClientType): CurseFile[] {
        const clientTypeStr = this.getClientTypeString(clientType);

        return _.flow(
            _.filter((f: CurseFile) => f.isAlternate == false && f.gameVersionFlavor == clientTypeStr),
            _.orderBy((f: CurseFile) => f.id),
            _.reverse
        )(result.latestFiles) as CurseFile[];
    }

    private getClientTypeString(clientType: WowClientType): string {
        switch (clientType) {
            case WowClientType.Classic:
            case WowClientType.ClassicPtr:
                return "wow_classic";
            case WowClientType.Retail:
            case WowClientType.RetailPtr:
            case WowClientType.Beta:
            default:
                return "wow_retail";
        }
    }

}