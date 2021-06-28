import { Pipe, PipeTransform } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

@Pipe({
  name: "localeDate",
})
export class NgxDatePipe implements PipeTransform {
  public constructor(private translateService: TranslateService) {}

  public transform(value: string | number): any {
    return new Date(value).toLocaleString(this.translateService.currentLang);
  }
}
