import { Pipe, PipeTransform } from "@angular/core";
import { getGameVersion } from "../utils/addon.utils";

@Pipe({
  name: "invertBool",
})
export class InvertBoolPipe implements PipeTransform {
  public transform(value: boolean): boolean {
    return !value;
  }
}
