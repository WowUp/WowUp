import { Pipe, PipeTransform } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

@Pipe({
  name: "localeDate",
})
export class NgxDatePipe implements PipeTransform {
  public constructor(private translateService: TranslateService) {}

  public transform(value: any, pattern = "fullDate"): any {
    return new Date(value).toLocaleString(this.translateService.currentLang);
  }
}
