import { CurseMatch } from "../../../common/curse/curse-match";

export interface CurseFingerprintsResponse {
  isCacheBuild: boolean;
  exactMatches: CurseMatch[];
  exactFingerprints: number[];
  partialMatches: CurseMatch[];
  partialMatchFingerprints: { [key: string]: number[] };
  installedFingerprints: number[];
  unmatchedFingerprints: number[];
}
