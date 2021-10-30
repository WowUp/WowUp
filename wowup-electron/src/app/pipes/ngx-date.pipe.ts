import { DatePipe } from "@angular/common";
import { Pipe, PipeTransform } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

@Pipe({
  name: "localeDate",
})
export class NgxDatePipe implements PipeTransform {
  public constructor(private translateService: TranslateService, private datePipe: DatePipe) {}

  public transform(value: string | number, pattern = "short"): any {
    return this.datePipe.transform(value, pattern, undefined, this.translateService.currentLang);
  }
}
