import { Pipe, PipeTransform } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { shortenDownloadCount } from "../utils/number.utils";

@Pipe({
  name: "downloadCount",
})
export class DownloadCountPipe implements PipeTransform {
  constructor(private translateService: TranslateService) {}

  transform(value: number, ...args: unknown[]): string {
    const numMatches = /(e\+\d+)/.exec(value.toExponential());
    const suffix = numMatches[1];

    return suffix
      ? this.translateService.instant("COMMON.DOWNLOAD_COUNT." + suffix, {
          rawCount: value,
          count: shortenDownloadCount(value, 3),
          simpleCount: shortenDownloadCount(value, 1),
          myriadCount: shortenDownloadCount(value, 4),
        })
      : value.toString();
  }
}
