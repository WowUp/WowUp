import { WowClientType } from '../../../shared/warcraft'
import { Product } from './product-db'

export interface IWarcraftClientPlatform {
  getBlizzardAgentPath(): Promise<string>
  getExecutableName(clientType: WowClientType): string
  resolveProducts(productDb: Product[], agentPath: string): Product[]
}
