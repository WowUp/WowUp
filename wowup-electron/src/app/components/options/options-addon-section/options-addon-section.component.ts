import { Component, NgZone, OnInit } from "@angular/core";
import { FormControl } from "@angular/forms";
import { AddonProviderState } from "../../../models/wowup/addon-provider-state";
import { MatSelectionListChange } from "@angular/material/list";
import { AddonProviderFactory } from "../../../services/addons/addon.provider.factory";
import { AddonProviderType } from "../../../addon-providers/addon-provider";
import { BehaviorSubject } from "rxjs";

@Component({
  selector: "app-options-addon-section",
  templateUrl: "./options-addon-section.component.html",
  styleUrls: ["./options-addon-section.component.scss"],
})
export class OptionsAddonSectionComponent implements OnInit {
  public addonProviderStates$ = new BehaviorSubject<AddonProviderState[]>([]);

  public constructor(private _addonProviderService: AddonProviderFactory) {
    this._addonProviderService.addonProviderChange$.subscribe(() => {
      this.loadProviderStates();
    });
  }

  public ngOnInit(): void {
    this.loadProviderStates();
  }

  public onProviderStateSelectionChange(event: MatSelectionListChange): void {
    event.options.forEach((option) => {
      const providerName: AddonProviderType = option.value;
      this._addonProviderService.setProviderEnabled(providerName, option.selected);
    });
  }

  private loadProviderStates() {
    this.addonProviderStates$.next(
      this._addonProviderService.getAddonProviderStates().filter((provider) => provider.canEdit)
    );
  }
}
