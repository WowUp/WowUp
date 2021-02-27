import { AddonDependencyType } from "./addon-dependency-type";

export interface AddonDependency {
  externalAddonId: string;
  type: AddonDependencyType;
}
