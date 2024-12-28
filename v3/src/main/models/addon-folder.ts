import { Toc } from '@shared/addons/toc'
import { Stats } from 'fs'
import { AddonScanResult } from './addon-scan-result'

export interface AddonFolder {
  name: string
  path: string
  tocs: Toc[]
  scanResults: AddonScanResult[]
  fileStats?: Stats
  isGitRepo?: boolean
}
