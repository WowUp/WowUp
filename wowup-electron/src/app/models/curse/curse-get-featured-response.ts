import { CurseSearchResult } from './curse-search-result';

export interface CurseGetFeaturedResponse {
  featured: CurseSearchResult[];
  popular: CurseSearchResult[];
  recentlyUpdated: CurseSearchResult[];
}