export interface Addon {
  id: string
  name: string
  providerName: string
  externalId: string
  externalIds: AddonExternalId[]
}

export interface AddonExternalId {
  providerName: string
  id: string
}
