import { Addon } from "../../entities/addon";
import { Toc } from "./toc";
import { Stats } from "fs";

export interface AddonFolder {
  name: string;
  path: string;
  status: string;
  thumbnailUrl?: string;
  latestVersion?: string;
  toc: Toc;
  tocMetaData: string[];
  matchingAddon?: Addon;
  fileStats?: Stats;
}
