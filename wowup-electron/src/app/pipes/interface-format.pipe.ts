import { Pipe, PipeTransform } from "@angular/core";
import { getGameVersion } from "wowup-lib-core";

@Pipe({
  name: "interfaceFormat",
})
export class InterfaceFormatPipe implements PipeTransform {
  public transform(value: string): string {
    return getGameVersion(value);
  }
}
