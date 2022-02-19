export const TOC_AUTHOR = "Author";
export const TOC_DEPENDENCIES = "Dependencies";
export const TOC_INTERFACE = "Interface";
export const TOC_NOTES = "Notes";
export const TOC_REQUIRED_DEPS = "RequiredDeps";
export const TOC_TITLE = "Title";
export const TOC_VERSION = "Version";
export const TOC_WEBSITE = "Website";
export const TOC_X_ADDON_PROVIDER = "X-AddonProvider"; // Raider.IO
export const TOC_X_CATEGORY = "X-Category";
export const TOC_X_CURSE_PROJECT_ID = "X-Curse-Project-ID"; // CurseForge
export const TOC_X_LOADONDEMAND = "LoadOnDemand";
export const TOC_X_LOCALIZATIONS = "X-Localizations";
export const TOC_X_PART_OF = "X-Part-Of";
export const TOC_X_TUKUI_PROJECTID = "X-Tukui-ProjectID"; // WowInterface
export const TOC_X_TUKUI_PROJECTFOLDERS = "X-Tukui-ProjectFolders"; // WowInterface
export const TOC_X_WEBSITE = "X-Website";
export const TOC_X_WOWI_ID = "X-WoWI-ID"; // WowInterface
export const TOC_X_WAGO_ID = "X-Wago-ID";

export interface Toc {
  fileName: string;
  filePath: string;
  interface: string;
  title?: string;
  author?: string;
  website?: string;
  version?: string;
  partOf?: string;
  category?: string;
  localizations?: string;
  dependencies?: string;
  curseProjectId?: string;
  wowInterfaceId?: string;
  wagoAddonId?: string;
  tukUiProjectId?: string;
  tukUiProjectFolders?: string;
  loadOnDemand?: string;
  dependencyList: string[];
  addonProvider?: string;
  notes?: string;
}
