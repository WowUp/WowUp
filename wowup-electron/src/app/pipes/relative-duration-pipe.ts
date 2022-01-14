import { Pipe, PipeTransform } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { getRelativeDateFormat } from "../utils/string.utils";

@Pipe({
  name: "relativeDuration",
})
export class RelativeDurationPipe implements PipeTransform {
  public constructor(private _translate: TranslateService) {}

  public transform(value: string): string {
    const [fmt, val] = getRelativeDateFormat(value);
    return this._translate.instant(fmt, val);
  }
}
