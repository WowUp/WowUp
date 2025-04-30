export interface WarcraftClient {
  id: string
  name: string
  location: string
  addonLocation: string
  wowClientType: WowClientType
}

// Grouping of the various clients into their expansions
export enum WowClientGroup {
  Retail,
  BurningCrusade,
  Classic,
  WOTLK,
  Cata
}

export enum WowGameType {
  Retail = 'retail',
  Classic = 'classic',
  BurningCrusade = 'burningCrusade',
  WOTLK = 'wotlk',
  Cata = 'cata'
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

export function getWowGameType(clientType: WowClientType): WowGameType {
  switch (clientType) {
    case WowClientType.ClassicEra:
    case WowClientType.ClassicEraPtr:
      return WowGameType.Classic
    case WowClientType.Classic:
    case WowClientType.ClassicPtr:
    case WowClientType.ClassicBeta:
      return WowGameType.Cata
    case WowClientType.Retail:
    case WowClientType.RetailPtr:
    case WowClientType.RetailXPtr:
    case WowClientType.Beta:
    default:
      return WowGameType.Retail
  }
}
