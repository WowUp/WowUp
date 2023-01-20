import * as _ from "lodash";
import {
  AddonChannelType,
  AddonDependencyType,
  AddonSearchResult,
  AddonSearchResultDependency,
  AddonSearchResultFile,
} from "wowup-lib-core";

export function getLatestFile(
  searchResult: AddonSearchResult | undefined,
  channel: AddonChannelType
): AddonSearchResultFile | undefined {
  if (!searchResult?.files) {
    console.warn(
      `Search result had no files: [${searchResult?.providerName ?? ""}:${searchResult?.externalId ?? ""}] ${
        searchResult?.name ?? ""
      }`
    );
    return undefined;
  }

  let files = _.filter(searchResult.files, (f) => f.channelType <= channel);
  files = _.orderBy(files, "releaseDate", "desc");
  let latestFile = _.first(files);

  // In the event that there are no matching files for the desired channel, return the latest regardless of channel
  if (!latestFile) {
    latestFile = _.first(_.orderBy(searchResult.files, "releaseDate", "desc"));
  }

  return latestFile;
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
