import { Component, OnInit } from "@angular/core";
import { AddonProviderState } from "../../../models/wowup/addon-provider-state";
import { MatSelectionListChange } from "@angular/material/list";
import { AddonProviderFactory } from "../../../services/addons/addon.provider.factory";
import { AddonProviderType } from "../../../addon-providers/addon-provider";
import { BehaviorSubject } from "rxjs";

interface AddonProviderStateModel extends AddonProviderState {
  adRequired: boolean;
}

@Component({
  selector: "app-options-addon-section",
  templateUrl: "./options-addon-section.component.html",
  styleUrls: ["./options-addon-section.component.scss"],
})
export class OptionsAddonSectionComponent implements OnInit {
  public addonProviderStates$ = new BehaviorSubject<AddonProviderStateModel[]>([]);

  public constructor(private _addonProviderService: AddonProviderFactory) {
    this._addonProviderService.addonProviderChange$.subscribe(() => {
      this.loadProviderStates();
    });
  }

  public ngOnInit(): void {
    this.loadProviderStates();
  }

  public async onProviderStateSelectionChange(event: MatSelectionListChange): Promise<void> {
    for (const option of event.options) {
      const providerName: AddonProviderType = option.value;
      await this._addonProviderService.setProviderEnabled(providerName, option.selected);
    }
  }

  private loadProviderStates() {
    const providerStates = this._addonProviderService.getAddonProviderStates().filter((provider) => provider.canEdit);
    const providerStateModels: AddonProviderStateModel[] = providerStates.map((state) => {
      const provider = this._addonProviderService.getProvider(state.providerName);
      return { ...state, adRequired: provider.adRequired };
    });

    this.addonProviderStates$.next(providerStateModels);
  }
}
