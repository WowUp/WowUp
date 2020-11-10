import { AddonDependencyType } from "./addon-dependency-type";

export interface AddonSearchResultDependency {
  externalAddonId: string;
  type: AddonDependencyType;
}
