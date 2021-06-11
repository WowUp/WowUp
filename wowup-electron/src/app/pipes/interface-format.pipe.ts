import { Pipe, PipeTransform } from "@angular/core";
import { getGameVersion } from "../utils/addon.utils";

@Pipe({
  name: "interfaceFormat",
})
export class InterfaceFormatPipe implements PipeTransform {
  public transform(value: string): string {
    return getGameVersion(value);
  }
}
