import { Pipe, PipeTransform } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

@Pipe({
  name: "downloadCount",
})
export class DownloadCountPipe implements PipeTransform {
  constructor(private translateService: TranslateService) {}

  transform(value: number, ...args: unknown[]): string {
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
      ? this.translateService.instant(
          "COMMON.DOWNLOAD_COUNT." + suffix,
          {count: downloadCount.toFixed(0)}
        )
      : "";
  }
}
