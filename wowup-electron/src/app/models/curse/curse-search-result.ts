import { CurseAuthor } from "../../../common/curse/curse-author";
import { CurseAttachment } from "../../../common/curse/curse-attachment";
import { CurseFile } from "../../../common/curse/curse-file";
import { CurseCategory } from "../../../common/curse/curse-category";
import { CurseCategorySection } from "../../../common/curse/curse-category-section";
import { CurseGameVersionLatestFile } from "../../../common/curse/curse-game-version-latest-file";

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
