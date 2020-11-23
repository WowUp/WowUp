import { CurseMatch } from "./curse-match";
import { CurseSearchResult } from "./curse-search-result";

export interface CurseScanResult {
  fileCount: number;
  fileDateHash?: number;
  fingerprint: number;
  folderName: string;
  individualFingerprints: number[];
  directory: string;
  exactMatch?: CurseMatch;
  searchResult?: CurseSearchResult;
}
