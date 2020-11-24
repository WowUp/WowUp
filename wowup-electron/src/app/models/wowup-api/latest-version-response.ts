import { LatestVersion } from "./latest-version";

export interface LatestVersionResponse extends LatestVersion {
  beta: LatestVersion;
  stable: LatestVersion;
  updater: LatestVersion;
}
