// Shared by the renderer and the main process, so nothing here may depend on Angular or Electron.
import * as _ from "lodash";
import { AddonChannelType, AddonSearchResult, AddonSearchResultFile } from "wowup-lib-core";

export function getLatestFile(
  searchResult: AddonSearchResult | undefined,
  channel: AddonChannelType,
): AddonSearchResultFile | undefined {
  if (!searchResult?.files) {
    console.warn(
      `Search result had no files: [${searchResult?.providerName ?? ""}:${searchResult?.externalId ?? ""}] ${
        searchResult?.name ?? ""
      }`,
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
