import { Injectable } from "@angular/core";
import { WarcraftServiceImpl } from "./warcraft.service.impl";
import { WarcraftServiceWin } from "./warcraft.service.win";
import { FileUtils } from "app/core/utils/file.utils";
import { ProductDb } from "app/models/warcraft/product-db";
import { InstalledProduct } from "app/models/warcraft/installed-product";
import { from, BehaviorSubject } from "rxjs";
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { map, filter, delay } from "rxjs/operators";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { StorageService } from "../storage/storage.service";
import log from 'electron-log';
import { WarcraftServiceMac } from "./warcraft.service.mac";
import { AddonFolder } from "app/models/wowup/addon-folder";
import { TocParser } from "app/core/utils/toc-parser";

const isWin = process.platform === "win32";
const isMac = process.platform === "darwin";

// WOW STRINGS
const CLIENT_RETAIL_FOLDER = '_retail_';
const CLIENT_RETAIL_PTR_FOLDER = '_ptr_';
const CLIENT_CLASSIC_FOLDER = '_classic_';
const CLIENT_CLASSIC_PTR_FOLDER = '_classic_ptr_';
const CLIENT_BETA_FOLDER = '_beta_';
const ADDON_FOLDER_NAME = 'AddOns';
const INTERFACE_FOLDER_NAME = 'Interface';

// PREFERENCE KEYS
const RETAIL_LOCATION_KEY = "wow_retail_location";
const RETAIL_PTR_LOCATION_KEY = "wow_retail_ptr_location";
const CLASSIC_LOCATION_KEY = "wow_classic_location";
const CLASSIC_PTR_LOCATION_KEY = "wow_classic_ptr_location";
const BETA_LOCATION_KEY = "wow_beta_location";

const readdirAsync = promisify(fs.readdir);

@Injectable({
    providedIn: 'root'
})
export class WarcraftService {

    private readonly _impl: WarcraftServiceImpl;
    private readonly _productsSrc = new BehaviorSubject<InstalledProduct[]>([]);

    private _productDbPath = '';

    public products$ = this._productsSrc.asObservable();
    public productsReady$ = this.products$
        .pipe(
            filter(products => Array.isArray(products))
        );

    public clientTypes$ = this.products$
        .pipe(
            map(products => products.map(product => product.clientType))
        );

    public clientTypesNames$ = this.products$
        .pipe(
            map(products => products.map(product => this.getClientDisplayName(product.clientType)))
        );

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

    public getExecutableName(clientType: WowClientType): string {
        return this._impl.getExecutableName(clientType);
    }

    public getFullExecutablePath(clientType: WowClientType): string {
        const clientLocation = this.getClientLocation(clientType);
        const clientFolder = this.getClientFolderName(clientType);
        const clientExecutable = this.getExecutableName(clientType);

        return path.join(clientLocation, clientFolder, clientExecutable);
    }

    public getFullClientPath(clientType: WowClientType): string {
        const clientLocation = this.getClientLocation(clientType);
        const clientFolder = this.getClientFolderName(clientType);

        return path.join(clientLocation, clientFolder);
    }

    public getAddonFolderPath(clientType: WowClientType): string {
        const fullClientPath = this.getFullClientPath(clientType);
        return path.join(fullClientPath, INTERFACE_FOLDER_NAME, ADDON_FOLDER_NAME);
    }

    public scanProducts() {
        const installedProducts = this.decodeProducts(this._productDbPath);

        for (let product of installedProducts) {
            const clientType = product.clientType;
            const clientLocation = this.getClientLocation(clientType);

            if (this.arePathsEqual(clientLocation, product.location)) {
                continue;
            }

            this.setClientLocation(clientType, product.location);
        }

        this._productsSrc.next(installedProducts);

        return installedProducts;
    }

    public async listAddons(clientType: WowClientType) {
        const addonFolders: AddonFolder[] = [];
        const addonFolderPath = this.getAddonFolderPath(clientType);

        // Folder may not exist if no addons have been installed
        if (!fs.existsSync(addonFolderPath)) {
            return addonFolders;
        }

        const files = fs.readdirSync(addonFolderPath, { withFileTypes: true });
        const directories = files.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);

        for (let i = 0; i < directories.length; i += 1) {
            const dir = directories[i];
            const addonFolder = await this.getAddonFolder(addonFolderPath, dir);
            if (addonFolder) {
                addonFolders.push(addonFolder);
            }
        }

        return addonFolders;
    }

    private async getAddonFolder(addonFolderPath: string, dir: string): Promise<AddonFolder> {
        try {
            const dirPath = path.join(addonFolderPath, dir);
            const dirFiles = fs.readdirSync(dirPath);
            // const dirFiles = await readdirAsync(dirPath);
            const tocFile = dirFiles.find(f => path.extname(f) === '.toc');
            if (!tocFile) {
                return null;
            }

            const toc = await this.getToc(path.join(dirPath, tocFile));

            return {
                name: dir,
                path: dirPath,
                status: 'Pending',
                toc: toc
            };
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    private async getToc(filePath: string) {
        const parser = new TocParser(filePath);
        return await parser.parse();
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
                    name: p.client.name,
                    clientType: this.getClientTypeForFolderName(p.client.name)
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