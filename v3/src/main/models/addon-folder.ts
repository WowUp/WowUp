import { Toc } from '@shared/addons/toc'
import { Stats } from 'fs'
import { AddonScanResult } from './addon-scan-result'
import { Addon } from '@shared/addons'

export interface AddonFolder {
  name: string
  path: string
  tocs: Toc[]
  scanResults: Map<string, AddonScanResult[]>
  fileStats?: Stats
  isGitRepo?: boolean
  matchingAddon?: Addon
}
