import { Injectable } from "@angular/core";
import { WarcraftServiceImpl } from "./warcraft.service.impl";
import { WarcraftServiceWin } from "./warcraft.service.win";
import { FileUtils } from "app/core/utils/file.utils";
import { ProductDb } from "app/models/warcraft/product-db";
import { InstalledProduct } from "app/models/warcraft/installed-product";
import { from } from "rxjs";
import * as path from 'path';
import { map } from "rxjs/operators";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { StorageService } from "../storage/storage.service";
import log from 'electron-log';
import { WarcraftServiceMac } from "./warcraft.service.mac";

const isWin = process.platform === "win32";
const isMac = process.platform === "darwin";

// WOW STRINGS
const InterfaceFolderName = "Interface";
const AddonFolderName = "AddOns";
const BetaExecutableName = "WowB.exe";
const RetailExecutableName = "Wow.exe";
const RetailPtrExecutableName = "WowT.exe";
const ClassicExecutableName = "WowClassic.exe";
const ClassicPtrExecutableName = "WowClassicT.exe";
const CLIENT_RETAIL_FOLDER = '_retail_';
const CLIENT_RETAIL_PTR_FOLDER = '_ptr_';
const CLIENT_CLASSIC_FOLDER = '_classic_';
const CLIENT_CLASSIC_PTR_FOLDER = '_classic_ptr_';
const CLIENT_BETA_FOLDER = '_beta_';

// PREFERENCE KEYS
const RETAIL_LOCATION_KEY = "wow_retail_location";
const RETAIL_PTR_LOCATION_KEY = "wow_retail_ptr_location";
const CLASSIC_LOCATION_KEY = "wow_classic_location";
const CLASSIC_PTR_LOCATION_KEY = "wow_classic_ptr_location";
const BETA_LOCATION_KEY = "wow_beta_location";

@Injectable({
    providedIn: 'root'
})
export class WarcraftService {

    private readonly _impl: WarcraftServiceImpl;

    private _productDbPath = '';

    constructor(
        private storage: StorageService
    ) {
        this._impl = this.getImplementation();

        from(this._impl.getBlizzardAgentPath())
            .pipe(
                map(productDbPath => this._productDbPath = productDbPath),
                map(() => this.scanProducts())
            )
            .subscribe();
    }

    public scanProducts() {
        const installedProducts = this.decodeProducts(this._productDbPath);

        for (let product of installedProducts) {
            const clientType = this.getClientTypeForFolderName(product.name);
            const clientLocation = this.getClientLocation(clientType);

            if (this.arePathsEqual(clientLocation, product.location)) {
                continue;
            }

            this.setClientLocation(clientType, product.location);
        }

        return installedProducts;
    }

    public getClientLocation(clientType: WowClientType) {
        const clientLocationKey = this.getClientLocationKey(clientType);
        return this.storage.getPreference<string>(clientLocationKey) || '';
    }

    public setClientLocation(clientType: WowClientType, clientPath: string) {
        const clientLocationKey = this.getClientLocationKey(clientType);
        return this.storage.setPreference(clientLocationKey, clientPath);
    }

    public getClientTypeForFolderName(folderName: string): WowClientType {
        switch (folderName) {
            case CLIENT_RETAIL_FOLDER:
                return WowClientType.Retail;
            case CLIENT_RETAIL_PTR_FOLDER:
                return WowClientType.RetailPtr;
            case CLIENT_CLASSIC_FOLDER:
                return WowClientType.Classic;
            case CLIENT_CLASSIC_PTR_FOLDER:
                return WowClientType.ClassicPtr;
            case CLIENT_BETA_FOLDER:
                return WowClientType.Beta;
            default:
                return WowClientType.Retail;
        }
    }

    public getClientFolderName(clientType: WowClientType) {
        switch (clientType) {
            case WowClientType.Retail:
                return CLIENT_RETAIL_FOLDER;
            case WowClientType.Classic:
                return CLIENT_CLASSIC_FOLDER;
            case WowClientType.RetailPtr:
                return CLIENT_RETAIL_PTR_FOLDER;
            case WowClientType.ClassicPtr:
                return CLIENT_CLASSIC_PTR_FOLDER;
            case WowClientType.Beta:
                return CLIENT_BETA_FOLDER;
            default:
                return '';
        }
    }

    public getClientDisplayName(clientType: WowClientType) {
        switch (clientType) {
            case WowClientType.Retail:
                return 'Retail';
            case WowClientType.Classic:
                return 'Classic';
            case WowClientType.RetailPtr:
                return 'Retail PTR';
            case WowClientType.ClassicPtr:
                return 'Classic PTR';
            case WowClientType.Beta:
                return 'Beta';
            default:
                return '';
        }
    }

    public getClientLocationKey(clientType: WowClientType) {
        switch (clientType) {
            case WowClientType.Retail:
                return RETAIL_LOCATION_KEY;
            case WowClientType.Classic:
                return CLASSIC_LOCATION_KEY;
            case WowClientType.RetailPtr:
                return RETAIL_PTR_LOCATION_KEY;
            case WowClientType.ClassicPtr:
                return CLASSIC_PTR_LOCATION_KEY;
            case WowClientType.Beta:
                return BETA_LOCATION_KEY;
            default:
                return '';
        }
    }

    private decodeProducts(productDbPath: string) {
        const productDbData = FileUtils.readFileSync(productDbPath);

        try {
            const productDb = ProductDb.decode(productDbData);
            const wowProducts: InstalledProduct[] = productDb.products
                .filter(p => p.family === 'wow')
                .map(p => ({
                    location: p.client.location,
                    name: p.client.name
                }));

            console.log(wowProducts)
            return wowProducts;
        } catch (e) {
            console.error('failed to decode product db')
            console.error(e);
            return [];
        }
    }

    private arePathsEqual(path1: string, path2: string) {
        return path.normalize(path1) === path.normalize(path2);
    }

    private getImplementation(): WarcraftServiceImpl {
        if (isWin) {
            return new WarcraftServiceWin();
        }

        if (isMac) {
            return new WarcraftServiceMac();
        }

        throw new Error('No warcraft service implementation found');
    }
}