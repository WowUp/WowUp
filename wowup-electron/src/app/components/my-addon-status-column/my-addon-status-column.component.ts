import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { AddonViewModel } from "app/business-objects/my-addon-list-item";
import { TranslateService } from "@ngx-translate/core";

@Component({
  selector: "app-my-addon-status-column",
  templateUrl: "./my-addon-status-column.component.html",
  styleUrls: ["./my-addon-status-column.component.scss"],
})
export class MyAddonStatusColumnComponent implements OnInit, OnDestroy {
  @Input() listItem: AddonViewModel;

  public get showStatusText() {
    return this.listItem?.isUpToDate || this.listItem?.isIgnored;
  }

  constructor(private _translateService: TranslateService) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {}

  public getStatusText() {
    if (this.listItem?.isUpToDate) {
      return this._translateService.instant("COMMON.ADDON_STATE.UPTODATE");
    }

    return this.listItem?.statusText;
  }
}
