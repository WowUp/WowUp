import { Injectable } from "@angular/core";

import { IPC_THEME_NATIVE_UPDATED, IPC_THEME_SHOULD_USE_DARK_COLORS } from "../../../common/constants";

import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class ThemeApiService {
  public constructor(private readonly _electronService: ElectronService) {}

  public getShouldUseDarkColors(): Promise<boolean> {
    return this._electronService.invoke(IPC_THEME_SHOULD_USE_DARK_COLORS);
  }

  public onShouldUseDarkColorsChanged(callback: (shouldUseDarkColors: boolean) => void): void {
    this._electronService.onRendererEvent(IPC_THEME_NATIVE_UPDATED, (_evt, shouldUseDarkColors: boolean) => {
      callback(shouldUseDarkColors);
    });
  }
}
