import * as path from 'path'
import { getDiskInfo } from 'node-disk-info'
import { IWarcraftClientPlatform } from './warcraft-client-platform'
import { pathExists } from '../../utilities/files'
import { Product } from './product-db'
import { WowClientType } from '../../../shared/warcraft'

const WOW_RETAIL_NAME = 'Wow.exe'
const WOW_RETAIL_PTR_NAME = 'WowT.exe'
const WOW_RETAIL_BETA_NAME = 'WowB.exe'
const WOW_CLASSIC_NAME = 'WowClassic.exe'
const WOW_CLASSIC_PTR_NAME = 'WowClassicT.exe'
const WOW_CLASSIC_BETA_NAME = 'WowClassicB.exe'

const WINDOWS_BLIZZARD_AGENT_PATH = `ProgramData/Battle.net/Agent`
const BLIZZARD_PRODUCT_DB_NAME = `product.db`

export class WarcraftClientPlatformWin implements IWarcraftClientPlatform {
  public getExecutableName(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Retail:
        return WOW_RETAIL_NAME
      case WowClientType.ClassicEra:
      case WowClientType.Classic:
        return WOW_CLASSIC_NAME
      case WowClientType.RetailPtr:
      case WowClientType.RetailXPtr:
        return WOW_RETAIL_PTR_NAME
      case WowClientType.ClassicPtr:
      case WowClientType.ClassicEraPtr:
        return WOW_CLASSIC_PTR_NAME
      case WowClientType.Beta:
        return WOW_RETAIL_BETA_NAME
      case WowClientType.ClassicBeta:
        return WOW_CLASSIC_BETA_NAME
      default:
        return ''
    }
  }

  public resolveProducts(productDb: Product[]): Product[] {
    return productDb
  }

  /**
   * Attempt to figure out where the blizzard agent was installed at
   */
  public async getBlizzardAgentPath(): Promise<string> {
    try {
      const diskInfo = await getDiskInfo()
      const driveNames: string[] = diskInfo.map((i) => i.mounted)

      for (const name of driveNames) {
        const agentPath = path.join(name, WINDOWS_BLIZZARD_AGENT_PATH, BLIZZARD_PRODUCT_DB_NAME)
        const exists = await pathExists(agentPath)

        if (exists) {
          console.log(`Found products at ${agentPath}`)
          return agentPath
        }
      }
    } catch (e) {
      console.error('Failed to search for blizzard products', e)
    }

    return ''
  }
}
