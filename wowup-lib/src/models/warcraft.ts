import { AddonChannelType, WowClientType } from '../types';

export class WowMajorVersion {
  static readonly RetailBeta = 12;
  static readonly Retail = 11;
  static readonly Mists = 5;
  static readonly Cata = 4;
  static readonly Wrath = 3;
  static readonly BurningCrusade = 2;
  static readonly Classic = 1;
}

export interface InstalledProduct {
  name: string;
  location: string;
  clientType: WowClientType;
}

export interface WowInstallation {
  id: string;
  clientType: WowClientType;
  location: string;
  label: string;
  displayName: string;
  selected: boolean;
  defaultAddonChannelType: AddonChannelType;
  defaultAutoUpdate: boolean;
  availableUpdateCount?: number;
}
