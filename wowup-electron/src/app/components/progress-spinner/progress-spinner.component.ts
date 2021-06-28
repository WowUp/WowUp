import { Component, Input, OnInit } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

@Component({
  selector: "app-progress-spinner",
  templateUrl: "./progress-spinner.component.html",
  styleUrls: ["./progress-spinner.component.scss"],
})
export class ProgressSpinnerComponent implements OnInit {
  @Input("message") public message = "";

  public defaultMessage = "";

  public constructor(private _translateService: TranslateService) {}

  public ngOnInit(): void {
    this._translateService.get("COMMON.PROGRESS_SPINNER.LOADING").subscribe((translatedStr) => {
      this.defaultMessage = translatedStr;
    });
  }
}
