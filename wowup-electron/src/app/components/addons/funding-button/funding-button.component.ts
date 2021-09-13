import { Component, Input, OnInit } from "@angular/core";
import { AddonFundingLink } from "../../../../common/entities/addon";

@Component({
  selector: "app-funding-button",
  templateUrl: "./funding-button.component.html",
  styleUrls: ["./funding-button.component.scss"],
})
export class FundingButtonComponent implements OnInit {
  @Input("funding") public funding!: AddonFundingLink;
  @Input("size") public size: "large" | "small" = "large";

  public isFontIcon = false;
  public iconSrc = "";
  public tooltipKey = "";
  public fundingName = "";

  public ngOnInit(): void {
    this.isFontIcon = this.getIsFontIcon();
    this.iconSrc = this.isFontIcon ? this.getFontIcon() : this.getFundingIcon();
    this.fundingName = this.getFundingName();
    this.tooltipKey = this.getFundingLocaleKey(this.fundingName);
  }

  public getTooltipKey(): string {
    return `PAGES.MY_ADDONS.FUNDING_TOOLTIP.${this.funding.platform.toUpperCase()}`;
  }

  public getClassName(): string {
    switch (this.funding.platform) {
      case "PATREON":
        return "patreon-icon";
      case "GITHUB":
        return "github-icon";
      default:
        return "custom-icon";
    }
  }
  private getIsFontIcon(): boolean {
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

  private getFontIcon(): string {
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

  private getFundingIcon(): string {
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

  private getFundingLocaleKey(fundingName: string): string {
    return fundingName && fundingName.toUpperCase() !== "CUSTOM"
      ? "PAGES.MY_ADDONS.FUNDING_TOOLTIP.GENERIC"
      : "PAGES.MY_ADDONS.FUNDING_TOOLTIP.CUSTOM";
  }

  private getFundingName(): string {
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
