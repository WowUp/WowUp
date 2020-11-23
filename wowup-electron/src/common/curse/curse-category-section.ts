export interface CurseCategorySection {
  id: number;
  gameId: number;
  name: string;
  packageType: number;
  path: string;
  initialInclusionPattern: string;
  extraIncludePattern: string;
  gameCategoryId: number;
}
