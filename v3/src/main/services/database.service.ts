import { Low } from 'lowdb'
import { JSONFilePreset } from 'lowdb/node'
import { WarcraftClient } from '../../shared/warcraft'
import { injectable } from 'inversify'
import { AddonCollection } from '../models/addon-collection'

interface Data {
  selectedClientId: string | null
  clients: WarcraftClient[]
  addons: AddonCollection[]
}

const defaultData: Data = { selectedClientId: null, clients: [], addons: [] }

export interface IDatabaseService {
  getClient: (clientId: string) => Promise<WarcraftClient | null>
  getClients: () => Promise<WarcraftClient[]>
  setClients: (warcraftClients: WarcraftClient[]) => Promise<void>
  getSelectedClientId: () => Promise<string | null>
  setSelectedClientId: (clientId: string | null) => Promise<void>
  getAllAddons: () => Promise<AddonCollection[]>
  getAddons: (clientId: string) => Promise<AddonCollection | null>
  setAddons: (addons: AddonCollection) => Promise<void>
}

@injectable()
export class DatabaseService implements IDatabaseService {
  private _db: Low<Data> | null = null

  public readonly getClient = async (clientId: string): Promise<WarcraftClient | null> => {
    const db = await this.getDb()
    return db.data.clients.find((client) => client.id === clientId) ?? null
  }

  public readonly getClients = async (): Promise<WarcraftClient[]> => {
    const db = await this.getDb()
    return [...db.data.clients]
  }

  public async setClients(warcraftClients: WarcraftClient[]): Promise<void> {
    const db = await this.getDb()
    db.data.clients = warcraftClients
    await db.write()
  }

  public async getSelectedClientId(): Promise<string | null> {
    const db = await this.getDb()
    return db.data.selectedClientId
  }

  public async setSelectedClientId(clientId: string | null): Promise<void> {
    const db = await this.getDb()
    db.data.selectedClientId = clientId
    await db.write()
  }

  public async getAllAddons(): Promise<AddonCollection[]> {
    const db = await this.getDb()
    return db.data.addons
  }

  public async getAddons(clientId: string): Promise<AddonCollection | null> {
    const db = await this.getDb()
    return (
      db.data.addons.find((addonCollection) => addonCollection.wowClientId === clientId) ?? null
    )
  }

  public async setAddons(addons: AddonCollection): Promise<void> {
    const db = await this.getDb()

    if (!Array.isArray(db.data.addons)) {
      db.data.addons = []
    }

    const index = db.data.addons.findIndex(
      (addonCollection) => addonCollection.wowClientId === addons.wowClientId
    )
    if (index === -1) {
      db.data.addons.push(addons)
    } else {
      db.data.addons[index] = addons
    }
    await db.write()
  }

  private readonly getDb = async (): Promise<Low<Data>> => {
    if (this._db === null) {
      this._db = await JSONFilePreset('db.json', defaultData)
    }
    return this._db
  }
}
