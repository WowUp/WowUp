export interface WarcraftClient {
  id: string
  name: string
  location: string
  addonLocation: string
  wowClientType: WowClientType
}

export enum WowClientType {
  Retail = 0,
  Classic = 1,
  RetailPtr = 2,
  ClassicPtr = 3,
  Beta = 4,
  ClassicBeta = 5,
  ClassicEra = 6,
  ClassicEraPtr = 7,
  RetailXPtr = 8,
  None = 9
}

export enum WowClientMessage {
  GetWowClients = 'get-wow-clients',
  SetSelectedWowClient = 'set-selected-wow-client',
  GetSelectedWowClient = 'get-selected-wow-client'
}
