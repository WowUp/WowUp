import { WowMajorVersion } from '../models/warcraft';
import { WowClientGroup, WowClientType, WowGameType } from '../types';

export function getWowClientGroup(gameType: WowGameType): WowClientGroup {
  switch (gameType) {
    case WowGameType.BurningCrusade:
      return WowClientGroup.BurningCrusade;
    case WowGameType.Classic:
      return WowClientGroup.Classic;
    case WowGameType.Retail:
      return WowClientGroup.Retail;
    case WowGameType.WOTLK:
      return WowClientGroup.WOTLK;
    case WowGameType.Cata:
      return WowClientGroup.Cata;
    case WowGameType.Mists:
      return WowClientGroup.Mists;
  }
}

export function getWowClientGroupForType(clientType: WowClientType): WowClientGroup {
  return getWowClientGroup(getWowGameType(clientType));
}

export function getWowGameType(clientType: WowClientType): WowGameType {
  switch (clientType) {
    case WowClientType.ClassicEra:
    case WowClientType.ClassicEraPtr:
      return WowGameType.Classic;
    case WowClientType.Classic:
    case WowClientType.ClassicPtr:
    case WowClientType.ClassicBeta:
      return WowGameType.Mists;
    case WowClientType.Anniversary:
      return WowGameType.BurningCrusade;
    case WowClientType.Retail:
    case WowClientType.RetailPtr:
    case WowClientType.RetailXPtr:
    case WowClientType.Beta:
    default:
      return WowGameType.Retail;
  }
}

export function getWowMajorVersion(clientType: WowClientType): number {
  switch (clientType) {
    case WowClientType.ClassicEra:
    case WowClientType.ClassicEraPtr:
      return WowMajorVersion.Classic;
    case WowClientType.Classic:
    case WowClientType.ClassicPtr:
    case WowClientType.ClassicBeta:
      return WowMajorVersion.Mists;
    case WowClientType.Anniversary:
      return WowMajorVersion.BurningCrusade;
    case WowClientType.Beta:
    case WowClientType.RetailPtr:
    case WowClientType.RetailXPtr:
      return WowMajorVersion.RetailBeta;
    case WowClientType.Retail:
    default:
      return WowMajorVersion.Retail;
  }
}
