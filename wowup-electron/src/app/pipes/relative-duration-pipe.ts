import { Pipe, PipeTransform } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

const YEAR_SECONDS = 31536000;
const MONTH_SECONDS = 2592000;
const DAY_SECONDS = 86400;
const HOUR_SECONDS = 3600;

@Pipe({
  name: "relativeDuration",
})
export class RelativeDurationPipe implements PipeTransform {
  constructor(private _translate: TranslateService) {}

  transform(value: string): string {
    if (!value) {
      return "";
    }

    let then: Date;
    try {
      then = new Date(value);
    } catch (error) {
      return "";
    }

    if (isNaN(then.getTime())) {
      return "";
    }

    const deltaMs = new Date().getTime() - then.getTime();

    let tempSec = Math.floor(deltaMs / 1000);

    const years = Math.floor(tempSec / YEAR_SECONDS);
    if (years) {
      return this._translate.instant("COMMON.DATES.YEARS_AGO", { count: years });
    }

    const months = Math.floor((tempSec %= YEAR_SECONDS) / MONTH_SECONDS);
    if (months) {
      return this._translate.instant("COMMON.DATES.MONTHS_AGO", { count: months });
    }

    const days = Math.floor((tempSec %= MONTH_SECONDS) / DAY_SECONDS);
    if (days > 1) {
      return this._translate.instant("COMMON.DATES.DAYS_AGO", { count: days });
    }

    if (days) {
      return this._translate.instant("COMMON.DATES.YESTERDAY");
    }

    const hours = Math.floor((tempSec %= DAY_SECONDS) / HOUR_SECONDS);
    if (hours) {
      return this._translate.instant("COMMON.DATES.HOURS_AGO", {
        count: hours,
      });
    }

    return this._translate.instant("COMMON.DATES.JUST_NOW");
  }
}
