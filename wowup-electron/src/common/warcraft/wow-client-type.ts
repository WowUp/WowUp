// Various client types that WoW has to offer
export enum WowClientType {
  Retail = 0,
  Classic,
  RetailPtr,
  ClassicPtr,
  Beta,
  ClassicBeta,
  ClassicEra,
  ClassicEraPtr,
  None,
}

// Grouping of the various clients into their expansions
export enum WowClientGroup {
  Retail,
  BurningCrusade,
  Classic,
  WOTLK,
}
