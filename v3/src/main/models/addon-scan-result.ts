import { AddonProviderType } from './addon-provider-type'

export interface AddonScanResult {
  source: AddonProviderType
  fileCount: number
  fileFingerprints?: string[]
  fingerprint: string
  fingerprintNum: number
  folderName: string
  path?: string
}
