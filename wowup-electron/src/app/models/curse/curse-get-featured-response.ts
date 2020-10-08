import { CurseSearchResult } from "../../../common/curse/curse-search-result";

export interface CurseGetFeaturedResponse {
  Featured: CurseSearchResult[];
  Popular: CurseSearchResult[];
  RecentlyUpdated: CurseSearchResult[];
}
