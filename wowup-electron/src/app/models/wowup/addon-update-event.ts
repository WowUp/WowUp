import { Addon } from "wowup-lib-core";
import { AddonInstallState } from "./addon-install-state";

export interface AddonUpdateEvent {
  addon: Addon;
  installState: AddonInstallState;
  progress: number;
}
