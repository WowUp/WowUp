import { Rectangle } from "electron";

export interface WindowState extends Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isFullScreen: boolean;
  centered?: boolean;
}
