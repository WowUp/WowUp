import { CurseDependencyType } from "./curse-dependency-type";

export interface CurseDependency {
  id: number;
  addonId: number;
  type: CurseDependencyType;
  fileId: number;
}
