import { Pipe, PipeTransform } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

@Pipe({
  name: "downloadCount",
})
export class DownloadCountPipe implements PipeTransform {
  constructor(private translateService: TranslateService) {}

  transform(value: number, ...args: unknown[]): string {
    let unit:number = Number(this.translateService.instant("COMMON.DOWNLOAD_COUNT.DIGIT_ABBR_UNIT"));
    if (!unit || isNaN(unit)) {
      let suffix = "";
      let downloadCount = value;
      if (downloadCount >= 1000000000) {
        suffix = "BILLION";
        downloadCount /= 1000000000.0;
      } else if (downloadCount >= 1000000) {
        suffix = "MILLION";
        downloadCount /= 1000000.0;
      } else if (downloadCount >= 1000) {
        suffix = "THOUSAND";
        downloadCount /= 1000.0;
      }
      return suffix
        ? this.translateService.instant("COMMON.DOWNLOAD_COUNT." + suffix, {
          count: downloadCount.toFixed(0),
        })
        : downloadCount.toString();
    } else {
      let index = Math.floor(Math.log10(value) / unit);
      let downloadCount = index === 0 ? value : value / Math.pow(Math.pow(10, unit), index);

      return this.translateService.instant(`COMMON.DOWNLOAD_COUNT.ABBR_SUFFIXES.${index}`, {
        count: downloadCount.toFixed(0)
      });
    }
  }
}
