import { Component, Input, OnInit } from "@angular/core";
import { AddonFundingLink } from "../../entities/addon";

@Component({
  selector: "app-funding-button",
  templateUrl: "./funding-button.component.html",
  styleUrls: ["./funding-button.component.scss"],
})
export class FundingButtonComponent implements OnInit {
  @Input("funding") funding: AddonFundingLink;
  @Input("size") size: "large" | "small" = "large";

  public isFontIcon = false;
  public iconSrc = "";
  public tooltipKey = "";
  public fundingName = "";

  constructor() {}

  ngOnInit(): void {
    this.isFontIcon = this.getIsFontIcon();
    this.iconSrc = this.isFontIcon ? this.getFontIcon() : this.getFundingIcon();
    this.fundingName = this.getFundingName();
    this.tooltipKey = this.getFundingLocaleKey(this.fundingName);
  }

  getTooltipKey() {
    return `PAGES.MY_ADDONS.FUNDING_TOOLTIP.${this.funding.platform.toUpperCase()}`;
  }

  getIsFontIcon(): boolean {
    switch (this.funding.platform) {
      case "PATREON":
      case "GITHUB":
        return true;
      case "LIBERAPAY":
      case "CUSTOM":
      default:
        return true;
    }
  }

  getFontIcon() {
    switch (this.funding.platform) {
      case "PATREON":
        return "fab:patreon";
      case "GITHUB":
        return "fab:github";
      case "LIBERAPAY":
      case "CUSTOM":
      default:
        return "fas:coins";
    }
  }

  getFundingIcon() {
    switch (this.funding.platform) {
      case "LIBERAPAY":
        return "assets/images/librepay_logo_small.png";
      case "PATREON":
        return "assets/images/patreon_logo_white.png";
      case "GITHUB":
        return "assets/images/github_logo_small.png";
      case "CUSTOM":
      default:
        return "assets/images/custom_funding_logo_small.png";
    }
  }

  getFundingLocaleKey(fundingName: string) {
    return fundingName && fundingName.toUpperCase() !== "CUSTOM"
      ? "PAGES.MY_ADDONS.FUNDING_TOOLTIP.GENERIC"
      : "PAGES.MY_ADDONS.FUNDING_TOOLTIP.CUSTOM";
  }

  getFundingName() {
    switch (this.funding.platform) {
      case "LIBERAPAY":
        return "Liberapay";
      case "PATREON":
        return "Patreon";
      case "GITHUB":
        return "GitHub";
      case "PAYPAL":
        return "PayPal";
      case "KO_FI":
        return "Ko-fi";
      case "CUSTOM":
      default:
        return "Custom";
    }
  }
}
