import { DatePipe } from "@angular/common";
import { Pipe, PipeTransform } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

@Pipe({
	name: "relativeDuration",
})
export class RelativeDurationPipe implements PipeTransform {
	constructor(
		public datepipe: DatePipe,
		private _translate: TranslateService
	) { }

	transform(value: string, format?: string): string {
		if (!value) {
			return '';
		}

		let then: Date;
		try {
			then = new Date(value);
		} catch (error) {
			return '';
		}

		const now = new Date();
		const seconds = Math.round((now.getTime() - then.getTime()) / 1000);
		const minutes = Math.round(seconds / 60);
		const hours = Math.round(minutes / 60);
		const days = Math.round(hours / 24);

		if (minutes < 60) {
			return this._translate.instant('COMMON.DATES.JUST_NOW');
		} else if (hours <= 25 && now.getDate() - then.getDate() === 1) {
			return this._translate.instant('COMMON.DATES.YESTERDAY');
		} else if (hours < 24) {
			return this._translate.instant('COMMON.DATES.HOURS_AGO', { count: hours });
		} else if (days <= 7) {
			return this._translate.instant('COMMON.DATES.DAYS_AGO', { count: days });
		}

		return this.datepipe.transform(value, !!format ? format : 'short');
	}
}
