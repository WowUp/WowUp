import { Component, Inject, OnInit } from "@angular/core";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { AddonDetailModel } from "app/models/wowup/addon-detail.model";

@Component({
  selector: "app-addon-detail",
  templateUrl: "./addon-detail.component.html",
  styleUrls: ["./addon-detail.component.scss"],
})
export class AddonDetailComponent implements OnInit {
  addonDetail: AddonDetailModel;

  constructor(@Inject(MAT_DIALOG_DATA) public data: AddonDetailModel) {
    this.addonDetail = this.data;
  }

  get defaultImageUrl(): string {
    return this.addonDetail?.screenshotUrls && this.addonDetail?.screenshotUrls[0]
      ? this.addonDetail?.screenshotUrls[0]
      : this.addonDetail?.thumbnailUrl
      ? this.addonDetail?.thumbnailUrl
      : "";
  }

  ngOnInit(): void {}

  installAddon() {}

  openInBrowser() {}
}
