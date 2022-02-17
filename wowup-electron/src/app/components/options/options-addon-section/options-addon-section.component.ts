import { Component, OnInit } from "@angular/core";
import { AddonProviderState } from "../../../models/wowup/addon-provider-state";
import { MatSelectionListChange } from "@angular/material/list";
import { AddonProviderFactory } from "../../../services/addons/addon.provider.factory";
import { AddonProviderType } from "../../../addon-providers/addon-provider";
import { BehaviorSubject, catchError, debounceTime, first, from, map, of } from "rxjs";
import { PreferenceStorageService } from "../../../services/storage/preference-storage.service";
import { PREF_CF2_API_KEY } from "../../../../common/constants";
import { FormControl, FormGroup } from "@angular/forms";

interface AddonProviderStateModel extends AddonProviderState {
  adRequired: boolean;
  providerNote?: string;
}

@Component({
  selector: "app-options-addon-section",
  templateUrl: "./options-addon-section.component.html",
  styleUrls: ["./options-addon-section.component.scss"],
})
export class OptionsAddonSectionComponent implements OnInit {
  public addonProviderStates$ = new BehaviorSubject<AddonProviderStateModel[]>([]);

  public preferenceForm = new FormGroup({
    cfV2ApiKey: new FormControl(""),
  });

  public constructor(
    private _addonProviderService: AddonProviderFactory,
    private _preferenceStorageService: PreferenceStorageService
  ) {
    this._addonProviderService.addonProviderChange$.subscribe(() => {
      this.loadProviderStates();
    });

    this.preferenceForm.valueChanges.pipe(debounceTime(300)).subscribe(async (ch) => {
      try {
        if (ch.cfV2ApiKey) {
          this._preferenceStorageService.setAsync(PREF_CF2_API_KEY, ch.cfV2ApiKey);
        }
      } catch (e) {
        console.error(e);
      }
    });
  }

  public ngOnInit(): void {
    this.loadProviderStates();
    this.loadCfV2ApiKey();
  }

  public async onProviderStateSelectionChange(event: MatSelectionListChange): Promise<void> {
    for (const option of event.options) {
      const providerName: AddonProviderType = option.value;
      await this._addonProviderService.setProviderEnabled(providerName, option.selected);
    }
  }

  private loadCfV2ApiKey() {
    from(this._preferenceStorageService.getAsync(PREF_CF2_API_KEY))
      .pipe(
        first(),
        map((apiKey) => {
          this.preferenceForm.get("cfV2ApiKey").setValue(apiKey);
        }),
        catchError((e) => {
          console.error(e);
          return of(undefined);
        })
      )
      .subscribe();
  }

  private loadProviderStates() {
    const providerStates = this._addonProviderService.getAddonProviderStates().filter((provider) => provider.canEdit);
    const providerStateModels: AddonProviderStateModel[] = providerStates.map((state) => {
      const provider = this._addonProviderService.getProvider(state.providerName);
      return { ...state, adRequired: provider.adRequired, providerNote: provider.providerNote };
    });

    this.addonProviderStates$.next(providerStateModels);
  }
}
