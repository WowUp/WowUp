export interface LegacyDatabaseDataRaw {
  addons: LegacyResultSet[];
  preferences: LegacyResultSet[];
}

export interface LegacyDatabaseData {
  addons: LegacyAddon[];
  preferences: LegacyPreference[];
}

export interface LegacyResultSet {
  columns: string[];
  values: any[][];
}

export interface LegacyAddon {
  ExternalId: string;
  ProviderName: string;
  IsIgnored: number;
  AutoUpdateEnabled: number;
  ClientType: number;
  ChannelType: number;
}

export interface LegacyPreference {
  Key: string;
  Value: string;
}
