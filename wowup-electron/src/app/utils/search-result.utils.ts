import { AddonDependencyType } from "../models/wowup/addon-dependency-type";
import { AddonSearchResultDependency } from "../models/wowup/addon-search-result-dependency";
import * as _ from "lodash";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import { AddonSearchResult } from "../models/wowup/addon-search-result";
import { AddonSearchResultFile } from "../models/wowup/addon-search-result-file";

export function getLatestFile(searchResult: AddonSearchResult, channel: AddonChannelType): AddonSearchResultFile {
  let files = _.filter(searchResult.files, (f) => f.channelType <= channel);
  files = _.orderBy(files, ["releaseDate"]).reverse();
  return _.first(files);
}

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
