import { AddonProviderType } from "wowup-lib-core";

export interface AddonProviderState {
  providerName: AddonProviderType;
  enabled: boolean;
  canEdit: boolean;
}
