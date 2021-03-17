export enum CurseDependencyType {
  EmbeddedLibrary = 1,
  OptionalDependency = 2,
  RequiredDependency = 3,
  Tool = 4,
  Incompatible = 5,
  Include = 6,
}

export enum CurseReleaseType {
  Release = 1,
  Beta = 2,
  Alpha = 3,
}

export interface CurseFingerprintsResponse {
  isCacheBuild: boolean;
  exactMatches: CurseMatch[];
  exactFingerprints: number[];
  partialMatches: CurseMatch[];
  partialMatchFingerprints: { [key: string]: number[] };
  installedFingerprints: number[];
  unmatchedFingerprints: number[];
}

export interface CurseGetFeaturedResponse {
  Featured: CurseSearchResult[];
  Popular: CurseSearchResult[];
  RecentlyUpdated: CurseSearchResult[];
}

export interface CurseSearchResult {
  id: number;
  name: string;
  authors: CurseAuthor[];
  attachments: CurseAttachment[];
  websiteUrl: string;
  gameId: number;
  defaultFileId: number;
  downloadCount: number;
  latestFiles: CurseFile[];
  catagories: CurseCategory[];
  status: number;
  primaryCategoryId: number;
  categorySection: CurseCategorySection;
  slug: string;
  gameVersionLatestFiles: CurseGameVersionLatestFile[];
  isFeatured: boolean;
  popularityScore: number;
  gamePopularityRank: number;
  primaryLanguage: string;
  gameSlug: string;
  gameName: string;
  portalName: string;
  dateModified: string;
  dateCreated: string;
  dateReleased: string;
  isAvailable: boolean;
  isExperiemental: boolean;
  summary: string;
}

export interface CurseSortableGameVersion {
  gameVersionPadded: string;
  gameVersion: string;
  gameVersionReleaseDate: string;
  gameVersionName: string;
}

export interface CurseDependency {
  id: number;
  addonId: number;
  type: CurseDependencyType;
  fileId: number;
}

export interface CurseModule {
  foldername: string;
  fingerprint: number;
  type: number;
}

export interface CurseGameVersionLatestFile {
  gameVersion: string;
  projectFileId: number;
  projectFileName: string;
  fileType: number;
  gameVersionFlavor: string;
}

export interface CurseCategory {
  categoryId: number;
  name: string;
  url: string;
  avatarUrl: string;
  parentId: number;
  rootId: number;
  projectId: number;
  avatarId: number;
  gameId: number;
}

export interface CurseCategorySection {
  id: number;
  gameId: number;
  name: string;
  packageType: number;
  path: string;
  initialInclusionPattern: string;
  extraIncludePattern: string;
  gameCategoryId: number;
}

export interface CurseAuthor {
  name: string;
  url: string;
  projectId: number;
  id: number;
  projectTitleId?: number;
  projectTitleTitle: string;
  userId: number;
  twitchId?: number;
}

export interface CurseFile {
  id: number;
  displayName: string;
  fileName: string;
  fileDate: string;
  fileLength: number;
  releaseType: CurseReleaseType;
  fileStatus: number;
  downloadUrl: string;
  isAlternate: boolean;
  alternateFileId: number;
  isAvailable: boolean;
  dependencies: CurseDependency[];
  modules: CurseModule[];
  packageFingerprint: number;
  gameVersion: string[];
  sortableGameVersion: CurseSortableGameVersion[];
  installMetadata: any;
  changelog: any;
  hasInstallScript: boolean;
  isCompatibleWithClient: boolean;
  categorySectionPackageType: number;
  restrictProjectFileAccess: number;
  projectStatus: number;
  renderCacheId?: number;
  fileLegacyMappingId: any;
  projectId: number;
  parentProjectFileId?: number;
  parentFileLegacyMappingId: any;
  fileTypeId?: number;
  exposeAsAlternative: any;
  packageFingerprintId: number;
  gameVersionDateReleased: string;
  gameVersionMappingId: number;
  gameVersionId: number;
  gameId: number;
  isServerPack: boolean;
  serverPackFileId?: number;
  gameVersionFlavor: string;
}

export interface CurseMatch {
  id: number;
  file: CurseFile;
  latestFiles: CurseFile[];
}

export interface CurseAttachment {
  id: number;
  projectId: number;
  description: string;
  isDefault: boolean;
  thumbnailUrl: string;
  title: string;
  url: string;
  status: number;
}
