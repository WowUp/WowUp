import { Pipe, PipeTransform } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { shortenDownloadCount } from "../utils/number.utils";

@Pipe({
  name: "downloadCount",
})
export class DownloadCountPipe implements PipeTransform {
  public constructor(private translateService: TranslateService) {}

  public transform(value: number): string {
    const numMatches = /(e\+\d+)/.exec(value.toExponential());
    if (!numMatches) {
      throw new Error("Failed to get matches");
    }

    const suffix = numMatches[1];

    const params = {
      rawCount: value,
      count: shortenDownloadCount(value, 3),
      simpleCount: shortenDownloadCount(value, 1),
      myriadCount: shortenDownloadCount(value, 4),
    };

    return suffix ? this.translateService.instant("COMMON.DOWNLOAD_COUNT." + suffix, params) : value.toString();
  }
}
