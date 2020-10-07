import { CurseSearchResult } from "../../app/models/curse/curse-search-result";
import { CurseMatch } from "./curse-match";

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
