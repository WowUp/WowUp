export type CF2SortOrder = "asc" | "desc";

export enum CF2GameType {
  WoW = 1,
}

export enum CF2WowGameVersionType {
  BurningCrusade = 73246, //WoW Burning Crusade Classic
  Classic = 67408, //WoW Classic
  Retail = 517, //WoW
}

export enum CF2ModStatus {
  New = 1,
  ChangesRequired = 2,
  UnderSoftReview = 3,
  Approved = 4,
  Rejected = 5,
  ChangesMade = 6,
  Inactive = 7,
  Abandoned = 8,
  Deleted = 9,
  UnderReview = 10,
}

export enum CF2FileReleaseType {
  Release = 1,
  Beta = 2,
  Alpha = 3,
}

export enum CF2FileStatus {
  Processing = 1,
  ChangesRequired = 2,
  UnderReview = 3,
  Approved = 4,
  Rejected = 5,
  MalwareDetected = 6,
  Deleted = 7,
  Archived = 8,
  Testing = 9,
  Released = 10,
  ReadyForReview = 11,
  Deprecated = 12,
  Baking = 13,
  AwaitingPublishing = 14,
  FailedPublishing = 15,
}

export enum CF2HashAlgo {
  Sha1 = 1,
  Md5 = 2,
}

export enum CF2FileRelationType {
  EmbeddedLibrary = 1,
  OptionalDependency = 2,
  RequiredDependency = 3,
  Tool = 4,
  Incompatible = 5,
  Include = 6,
}

export enum CF2ModLoaderType {
  Any = 0,
  Forge = 1,
  Cauldron = 2,
  LiteLoader = 3,
  Fabric = 4,
}

export interface CF2AddonLinks {
  websiteUrl: string;
  wikiUrl: string;
  issuesUrl: string;
  sourceUrl: string;
}

export interface CF2Category {
  id: number;
  gameId: number;
  name: string;
  slug: string;
  url: string;
  iconUrl: string;
  dateModified: string;
  isClass?: boolean;
  classId?: number;
  parentCategoryId?: number;
}

export interface CF2Author {
  id: number;
  name: string;
  url: string;
}

export interface CF2Asset {
  id: number;
  modId: number;
  title: string;
  description: string;
  thumbnailUrl: string;
  url: string;
}

export interface CF2FileHash {
  value: string;
  algo: CF2HashAlgo;
}

export interface CF2SortableGameVersion {
  gameVersionName: string;
  gameVersionPadded: string;
  gameVersion: string;
  gameVersionReleaseDate: string;
  gameVersionTypeId?: number;
}

export interface CF2FileDependency {
  modId: number;
  fileId: number;
  relationType: CF2FileRelationType;
}

export interface CF2FileModule {
  name: string;
  fingerprint: number;
}

export interface CF2File {
  id: number;
  gameId: number;
  modId: number;
  isAvailable: boolean;
  displayName: string;
  fileName: string;
  releaseType: CF2FileReleaseType;
  fileStatus: CF2FileStatus;
  hashes: CF2FileHash[];
  fileDate: string;
  fileLength: number;
  downloadCount: number;
  downloadUrl: string;
  gameVersions: string[];
  sortableGameVersions: CF2SortableGameVersion[];
  dependencies: CF2FileDependency[];
  exposeAsAlternative?: boolean;
  parentProjectFileId?: number;
  alternateFileId?: number;
  isServerPack?: number;
  serverPackFileId?: number;
  fileFingerprint: number;
  modules: CF2FileModule[];
}

export interface CF2FileIndex {
  gameVersion: string;
  fileId: number;
  filename: string;
  releaseType: CF2FileReleaseType;
  gameVersionTypeId?: number;
  modLoader?: CF2ModLoaderType;
}

export interface CF2Addon {
  id: number;
  gameId: number;
  name: string;
  slug: string;
  links: CF2AddonLinks;
  summary: string;
  status: CF2ModStatus;
  downloadCount: number;
  isFeatured: boolean;
  primaryCategoryId: number;
  categories: CF2Category[];
  authors: CF2Author[];
  logo: CF2Asset;
  screenshots: CF2Asset[];
  mainFileId: number;
  latestFiles: CF2File[];
  latestFilesIndexes: CF2FileIndex[];
  dateCreated: string;
  dateModified: string;
  dateReleased: string;
  allowModDistribution?: boolean;
}

export interface CF2FingerprintMatch {
  id: number;
  file: CF2File;
  latestFiles: CF2File[];
}

export interface CF2FingerprintsMatchesResult {
  isCacheBuilt: boolean;
  exactMatches: CF2FingerprintMatch[];
  exactFingerprints: number[];
  partialMatches: CF2FingerprintMatch[];
  partialMatchFingerprints: any;
  additionalProperties: number[];
  installedFingerprints: number[];
  unmatchedFingerprints: number[];
}

export interface CF2Pagination {
  index: number;
  pageSize: number;
  resultCount: number;
  totalCount: number;
}

// REQUESTS
export interface GetFeaturedModsRequestBody {
  gameId: number;
  excludedModIds: number[];
  gameVersionTypeId?: number;
}

export interface CF2GetModsRequest {
  modIds: number[];
}

export interface CF2SearchModsParams {
  gameId?: number;
  classId?: number;
  categoryId?: number;
  gameVersion?: string;
  searchFilter?: string;
  sortField?: any;
  sortOrder?: CF2SortOrder;
  modLoaderType?: string;
  gameVersionTypeId?: number;
  index?: number;
  pageSize?: number;
}

export interface CF2GetFingerprintMatchesRequest {
  fingerprints: number[];
}

// RESPONSES
export interface CF2GetAddonResponse {
  data: CF2Addon;
}

export interface CF2FeaturedModsResponse {
  data: {
    featured: CF2Addon[];
    popular: CF2Addon[];
    recentlyUpdated: CF2Addon[];
  };
}

export interface CF2GetFeaturedModsResponse {
  data: CF2FeaturedModsResponse;
}

export interface CF2GetFingerprintMatchesResponse {
  data: CF2FingerprintsMatchesResult;
}

export interface CF2GetModDescriptionResponse {
  data: string;
}

export interface CF2GetModFileChangelogResponse {
  data: string;
}

export interface CF2GetModsResponse {
  data: CF2Addon[];
}

export interface CF2SearchModsResponse {
  data: CF2Addon[];
  pagination: CF2Pagination;
}

export interface CF2GetModFileResponse {
  data: CF2File;
}

export interface CF2GetFeaturedModsRequest {
  gameId: number;
  excludedModIds: number[];
  gameVersionTypeId?: number;
}
