import { Addon } from "../../../common/entities/addon";
import { AddonInstallState } from "./addon-install-state";

export interface AddonUpdateEvent {
  addon: Addon;
  installState: AddonInstallState;
  progress: number;
}
