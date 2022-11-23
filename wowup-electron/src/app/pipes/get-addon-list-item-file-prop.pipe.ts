import { Pipe, PipeTransform } from "@angular/core";
import { AddonChannelType } from "wowup-lib-core";
import { GetAddonListItem } from "../business-objects/get-addon-list-item";
import * as SearchResults from "../utils/search-result.utils";

@Pipe({
  name: "getAddonListItemFileProp",
})
export class GetAddonListItemFilePropPipe implements PipeTransform {
  public transform(item: GetAddonListItem, prop: string, channel: AddonChannelType): any {
    const file = SearchResults.getLatestFile(item.searchResult, channel);
    return file && Object.prototype.hasOwnProperty.call(file, prop) ? file[prop] : "";
  }
}
