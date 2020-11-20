import { DecimalPipe, formatNumber } from "@angular/common";
import { Pipe, PipeTransform } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

@Pipe({
  name: "downloadCount",
})
export class DownloadCountPipe implements PipeTransform {
  constructor(private translateService: TranslateService) {}

  shortenDownloadCount(value: number, nDigit: number): string {
    const exponent = Math.log10(value);
    const nGroups = Math.floor(exponent / nDigit);
    const shortValue = value / Math.pow(10, nGroups * nDigit);
    return shortValue.toFixed(0);
  }

  transform(value: number, ...args: unknown[]): string {
    const numMatches = /(e\+\d+)/.exec(value.toExponential());
    const suffix = numMatches[1];

    return suffix
      ? this.translateService.instant("COMMON.DOWNLOAD_COUNT." + suffix, {
          count: this.shortenDownloadCount(value, 3),
          simpleCount: this.shortenDownloadCount(value, 1),
          myriadCount: this.shortenDownloadCount(value, 4),
        })
      : value.toString();
  }
}
