export interface AddonDetailsResponseV4 {
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

export interface AddonDetailsResponseV3 {
  UID: string;
  UICATID: string;
  UIVersion: string;
  UIDate: number;
  UIMD5: string;
  UIFileName: string;
  UIDownload: string;
  UIPending: string;
  UIName: string;
  UIAuthorName: string;
  UIDescription: string;
  UIChangeLog: string;
  UIHitCount: string;
  UIHitCountMonthly: string;
  UIFavoriteTotal: string;
}

export interface Image {
  thumbUrl: string;
  imageUrl: string;
  description: string;
}
