import { Pipe, PipeTransform } from "@angular/core";
import { GetAddonListItem } from "../business-objects/get-addon-list-item";
import { AddonChannelType } from "../models/wowup/addon-channel-type";

@Pipe({
	name: "getAddonListItemFileProp",
})
export class GetAddonListItemFilePropPipe implements PipeTransform {
	transform(item: GetAddonListItem, prop: string, channel: AddonChannelType): any {
		const file = item.getLatestFile(channel);
		return file && file.hasOwnProperty(prop) ? file[prop] : '';
	}
}
