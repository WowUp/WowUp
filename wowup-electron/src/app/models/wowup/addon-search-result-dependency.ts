import { AddonDependencyType } from "../../../common/wowup/models";

export interface AddonSearchResultDependency {
  externalAddonId: string;
  type: AddonDependencyType;
}
