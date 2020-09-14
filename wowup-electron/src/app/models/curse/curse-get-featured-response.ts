import { CurseSearchResult } from './curse-search-result';

export interface CurseGetFeaturedResponse {
  Featured: CurseSearchResult[];
  Popular: CurseSearchResult[];
  RecentlyUpdated: CurseSearchResult[];
}