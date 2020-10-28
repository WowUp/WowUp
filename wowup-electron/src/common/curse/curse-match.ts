import { CurseFile } from "./curse-file";

export interface CurseMatch {
  id: number;
  file: CurseFile;
  latestFiles: CurseFile[];
}
