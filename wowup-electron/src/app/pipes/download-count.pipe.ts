import { DecimalPipe, formatNumber } from "@angular/common";
import { Pipe, PipeTransform } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

@Pipe({
  name: "downloadCount",
})
export class DownloadCountPipe implements PipeTransform {
  constructor(private translateService: TranslateService) {}

  transform(value: number, ...args: unknown[]): string {
    const numMatches = /(e\+\d+)/.exec(value.toExponential());
    const suffix = numMatches[1];

    let downloadCount = value;
    if (downloadCount >= 1000000000) {
      downloadCount /= 1000000000.0;
    } else if (downloadCount >= 1000000) {
      downloadCount /= 1000000.0;
    } else if (downloadCount >= 1000) {
      downloadCount /= 1000.0;
    }

    return suffix
      ? this.translateService.instant("COMMON.DOWNLOAD_COUNT." + suffix, {
          count: downloadCount.toFixed(0),
        })
      : downloadCount.toString();
  }
}
