import { Low } from 'lowdb'
import { JSONFilePreset } from 'lowdb/node'
import { WarcraftClient } from '../../shared/warcraft'
import { injectable } from 'inversify'

interface Data {
  selectedClientId: string | null
  clients: WarcraftClient[]
}

const defaultData: Data = { selectedClientId: null, clients: [] }

export interface IDatabaseService {
  getClient: (clientId: string) => Promise<WarcraftClient | null>
  getClients: () => Promise<WarcraftClient[]>
  setClients: (warcraftClients: WarcraftClient[]) => Promise<void>
  getSelectedClientId: () => Promise<string | null>
  setSelectedClientId: (clientId: string | null) => Promise<void>
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

  private readonly getDb = async (): Promise<Low<Data>> => {
    if (this._db === null) {
      this._db = await JSONFilePreset('db.json', defaultData)
    }
    return this._db
  }
}
