import { Component, OnInit } from "@angular/core";
import { WowUpService } from "app/services/wowup/wowup.service";
import { AddonProviderFactory } from "../../services/addons/addon.provider.factory";
import { MatSelectChange } from "@angular/material/select";
import { AddonProvider } from "../../addon-providers/addon-provider";

@Component({
  selector: "app-options-addon-section",
  templateUrl: "./options-addon-section.component.html",
  styleUrls: ["./options-addon-section.component.scss"],
})
export class OptionsAddonSectionComponent implements OnInit {
  constructor(
    private _addonProviderFactory: AddonProviderFactory,
    private _wowupService: WowUpService
  ) {}

  ngOnInit(): void {}

  public onEnabledProvidersChange(event: MatSelectChange): void {
    this._wowupService.enabledAddonProviders = event.value;
  }

  public get addonProviders(): AddonProvider[] {
    return this._addonProviderFactory.getAll();
  }
  public get enabledAddonProviders(): string[] {
    return this._wowupService.enabledAddonProviders;
  }
}
