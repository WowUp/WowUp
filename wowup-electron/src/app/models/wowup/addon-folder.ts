import { FsStats } from "../../../common/models/ipc-events";
import { Addon } from "../../entities/addon";
import { Toc } from "./toc";

export interface AddonFolder {
  name: string;
  path: string;
  status: string;
  ignoreReason?: AddonIgnoreReason;
  thumbnailUrl?: string;
  latestVersion?: string;
  toc: Toc;
  tocMetaData: string[];
  matchingAddon?: Addon;
  fileStats?: FsStats;
}
