import * as _ from "lodash";
import {
  AddonChannelType,
  AddonDependencyType,
  AddonSearchResult,
  AddonSearchResultDependency,
} from "wowup-lib-core";

import { getLatestFile } from "../../common/addons/search-results";

// Moved to src/common so the main process can use it, re-exported so call sites keep their imports
export { getLatestFile };

export function getDependencies(
  searchResult: AddonSearchResult,
  channel: AddonChannelType
): AddonSearchResultDependency[] {
  return getLatestFile(searchResult, channel)?.dependencies || [];
}

export function getDependencyType(
  searchResult: AddonSearchResult,
  channel: AddonChannelType,
  dependencyType: AddonDependencyType
): AddonSearchResultDependency[] {
  return _.filter(getDependencies(searchResult, channel), (dep) => dep.type === dependencyType);
}
