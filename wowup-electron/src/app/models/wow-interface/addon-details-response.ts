import { Image } from "./image";

export interface AddonDetailsResponse {
  id: number;
  categoryId: number;
  version: string;
  lastUpdate: number;
  checksum: string;
  fileName: string;
  downloadUri: string;
  pendingUpdate: string;
  title: string;
  author: string;
  description: string;
  changeLog: string;
  downloads: number;
  downloadsMonthly: number;
  favorites: number;

  images: Image[];
}
