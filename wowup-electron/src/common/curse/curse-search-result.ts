import { CurseAuthor } from "./curse-author";
import { CurseAttachment } from "./curse-attachment";
import { CurseFile } from "./curse-file";
import { CurseCategory } from "./curse-category";
import { CurseCategorySection } from "./curse-category-section";
import { CurseGameVersionLatestFile } from "./curse-game-version-latest-file";

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
