import { Pipe, PipeTransform } from "@angular/core";
import { getGameVersion } from "../utils/addon.utils";

@Pipe({
  name: "interfaceFormat",
})
export class InterfaceFormatPipe implements PipeTransform {
  transform(value: string, ...args: unknown[]): string {
    return getGameVersion(value);
  }
}
