import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs/promises'
import * as path from 'path'
import { inject, injectable } from 'inversify'
import { DatabaseService, type IDatabaseService } from '../database.service'
import { IWarcraftClientPlatform } from './warcraft-client-platform'
import { WarcraftClientPlatformWin } from './wacraft-client-platform.win'
import { Product, ProductDb } from './product-db'
import { IService } from '../service'
import { WarcraftClient, WowClientType } from '../../../shared/warcraft'

export const WOW_BETA_FOLDER = '_beta_'
export const WOW_CLASSIC_FOLDER = '_classic_'
export const WOW_CLASSIC_BETA_FOLDER = '_classic_beta_'
export const WOW_CLASSIC_ERA_FOLDER = '_classic_era_'
export const WOW_CLASSIC_ERA_PTR_FOLDER = '_classic_era_ptr_'
export const WOW_CLASSIC_PTR_FOLDER = '_classic_ptr_'
export const WOW_RETAIL_PTR_FOLDER = '_ptr_'
export const WOW_RETAIL_XPTR_FOLDER = '_xptr_'
export const WOW_RETAIL_FOLDER = '_retail_'
export const WOW_ADDON_FOLDER_NAME = 'AddOns'
export const WOW_INTERFACE_FOLDER_NAME = 'Interface'

export interface IWarcraftClientService extends IService {
  getAllClients(): Promise<WarcraftClient[]>
  getSelectedClientId(): Promise<string | null>
  setSelectedClientId(clientId: string | null): Promise<void>
}

@injectable()
export class WarcraftClientService implements IWarcraftClientService {
  private readonly _databaseService: IDatabaseService
  private readonly _clientPlatform: IWarcraftClientPlatform

  public constructor(@inject(DatabaseService) databaseService: IDatabaseService) {
    this._databaseService = databaseService
    this._clientPlatform = this.getClientPlatform()

    this.initClients().then(() => this.initSelectedClient())
  }

  public init(): void {
    console.debug('init')
  }

  public async setSelectedClientId(clientId: string | null): Promise<void> {
    await this._databaseService.setSelectedClientId(clientId)
  }

  public async getSelectedClientId(): Promise<string | null> {
    return await this._databaseService.getSelectedClientId()
  }

  public async getAllClients(): Promise<WarcraftClient[]> {
    return await this._databaseService.getClients()
  }

  private async initSelectedClient(): Promise<void> {
    const selectedClientId = await this._databaseService.getSelectedClientId()
    if (selectedClientId !== null) {
      return
    }

    const clients = await this._databaseService.getClients()
    if (clients.length > 0) {
      await this._databaseService.setSelectedClientId(clients[0].id)
    }
  }

  private async initClients(): Promise<void> {
    const agentPath = await this._clientPlatform.getBlizzardAgentPath()
    if (agentPath.length === 0) {
      return
    }

    console.debug('agent', agentPath)

    const storedClients = await this._databaseService.getClients()
    const productDb = await this.readProductDb(agentPath)

    let wowProducts = productDb.products.filter((x) => x.family === 'wow')
    wowProducts.forEach((x) => (x.wowClientType = this.getClientTypeForFolderName(x.client.name)))

    wowProducts = this._clientPlatform.resolveProducts(wowProducts, agentPath)

    const warcraftClients: WarcraftClient[] = wowProducts.map((x) => ({
      id: uuidv4(),
      name: x.name,
      location: this.getFullClientPath(x),
      addonLocation: '',
      wowClientType: x.wowClientType ?? WowClientType.None
    }))
    warcraftClients.forEach((x) => {
      x.addonLocation = this.getAddonFolderPath(x)
    })

    const update: WarcraftClient[] = [...storedClients]
    warcraftClients.forEach((wc) => {
      const storedIdx = update.findIndex((x) => x.location === wc.location)
      if (storedIdx === -1) {
        update.push(wc)
      }
    })

    this._databaseService.setClients(update)
  }

  private getAddonFolderPath(wowClient: WarcraftClient): string {
    const installDir = path.dirname(wowClient.location)
    return path.join(installDir, WOW_INTERFACE_FOLDER_NAME, WOW_ADDON_FOLDER_NAME)
  }

  private getFullClientPath(product: Product): string {
    const clientFolderName = this.getWowClientFolderName(
      product.wowClientType ?? WowClientType.None
    )

    const executableName = this._clientPlatform.getExecutableName(
      product.wowClientType ?? WowClientType.None
    )

    return path.join(product.client.location, clientFolderName, executableName)
  }

  private getClientPlatform(): IWarcraftClientPlatform {
    switch (process.platform) {
      case 'win32':
        return new WarcraftClientPlatformWin()
    }
    throw new Error('unsupported platform: ' + process.platform)
  }

  private async readProductDb(dbPath: string): Promise<ProductDb> {
    const productDbData = await fs.readFile(dbPath)
    const root = await ProductDb.decode(productDbData)
    console.debug(root)
    return root
  }

  private getClientTypeForFolderName(folderName: string): WowClientType {
    switch (folderName) {
      case WOW_RETAIL_FOLDER:
        return WowClientType.Retail
      case WOW_RETAIL_PTR_FOLDER:
        return WowClientType.RetailPtr
      case WOW_RETAIL_XPTR_FOLDER:
        return WowClientType.RetailXPtr
      case WOW_CLASSIC_ERA_FOLDER:
        return WowClientType.ClassicEra
      case WOW_CLASSIC_FOLDER:
        return WowClientType.Classic
      case WOW_CLASSIC_PTR_FOLDER:
        return WowClientType.ClassicPtr
      case WOW_BETA_FOLDER:
        return WowClientType.Beta
      case WOW_CLASSIC_BETA_FOLDER:
        return WowClientType.ClassicBeta
      case WOW_CLASSIC_ERA_PTR_FOLDER:
        return WowClientType.ClassicEraPtr
      default:
        return WowClientType.None
    }
  }

  private getWowClientFolderName(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Retail:
        return WOW_RETAIL_FOLDER
      case WowClientType.ClassicEra:
        return WOW_CLASSIC_ERA_FOLDER
      case WowClientType.Classic:
        return WOW_CLASSIC_FOLDER
      case WowClientType.RetailPtr:
        return WOW_RETAIL_PTR_FOLDER
      case WowClientType.RetailXPtr:
        return WOW_RETAIL_XPTR_FOLDER
      case WowClientType.ClassicPtr:
        return WOW_CLASSIC_PTR_FOLDER
      case WowClientType.Beta:
        return WOW_BETA_FOLDER
      case WowClientType.ClassicBeta:
        return WOW_CLASSIC_BETA_FOLDER
      case WowClientType.ClassicEraPtr:
        return WOW_CLASSIC_ERA_PTR_FOLDER
      default:
        return ''
    }
  }
}
