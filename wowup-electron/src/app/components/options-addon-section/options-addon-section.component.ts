import { Component, OnInit } from "@angular/core";
import { MatSelectChange } from "@angular/material/select";
import { FormControl } from "@angular/forms";
import { filter } from "lodash";
import { WowUpService } from "../../services/wowup/wowup.service";
import { AddonService } from "../../services/addons/addon.service";
import { AddonProviderState } from "../../models/wowup/addon-provider-state";
import { MatSelectionListChange } from "@angular/material/list";

@Component({
  selector: "app-options-addon-section",
  templateUrl: "./options-addon-section.component.html",
  styleUrls: ["./options-addon-section.component.scss"],
})
export class OptionsAddonSectionComponent implements OnInit {
  public enabledAddonProviders = new FormControl();
  public addonProviderStates: AddonProviderState[] = [];

  constructor(private _addonService: AddonService, private _wowupService: WowUpService) {}

  ngOnInit(): void {
    this.addonProviderStates = filter(this._addonService.getAddonProviderStates(), (provider) => provider.canEdit);
    this.enabledAddonProviders.setValue(this.getEnabledProviderNames());
    console.debug("addonProviderStates", this.addonProviderStates);
  }

  public onProviderStateSelectionChange(event: MatSelectionListChange) {
    console.debug(event);
    event.options.forEach((option) => {
      this._wowupService.setAddonProviderState({
        providerName: option.value,
        enabled: option.selected,
        canEdit: true,
      });
      this._addonService.setProviderEnabled(option.value, option.selected);
    });
  }

  private getEnabledProviders() {
    return this.addonProviderStates.filter((state) => state.enabled);
  }

  private getEnabledProviderNames() {
    return this.getEnabledProviders().map((provider) => provider.providerName);
  }
}
