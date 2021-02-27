import { AddonDependencyType } from "../../../common/wowup/addon-dependency-type";

export interface AddonSearchResultDependency {
  externalAddonId: string;
  type: AddonDependencyType;
}
