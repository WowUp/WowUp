import { Pipe, PipeTransform } from "@angular/core";
import { GetAddonListItem } from "../business-objects/get-addon-list-item";
import { AddonChannelType } from "../models/wowup/addon-channel-type";
import * as _ from "lodash";

@Pipe({
  name: "getAddonListItemFileProp",
})
export class GetAddonListItemFilePropPipe implements PipeTransform {
  transform(
    item: GetAddonListItem,
    prop: string,
    channel: AddonChannelType
  ): any {
    let file = item.getLatestFile(channel);
    if (!file) {
      file = _.first(_.orderBy(item.searchResult.files, "releaseDate", "desc"));
    }
    return file && file.hasOwnProperty(prop) ? file[prop] : "";
  }
}
