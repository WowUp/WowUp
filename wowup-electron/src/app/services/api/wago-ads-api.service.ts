import { Injectable } from "@angular/core";
import { AdPageOptions } from "wowup-lib-core";

import {
  IPC_WAGO_ADS_DISABLE,
  IPC_WAGO_ADS_LOAD,
  IPC_WAGO_ADS_OPEN_DEV_TOOLS,
  IPC_WAGO_ADS_RELOAD,
  IPC_WAGO_ADS_RESURFACE_CMP,
  IPC_WAGO_ADS_SET_BOUNDS,
  IPC_WAGO_ADS_SHOW_CMP,
} from "../../../common/constants";
import { ElectronService } from "../electron/electron.service";

/** Where the ad view should sit, in css pixels relative to the viewport. */
export interface AdViewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Injectable({
  providedIn: "root",
})
export class WagoAdsApiService {
  public constructor(private readonly _electronService: ElectronService) {}

  public load(options: AdPageOptions): Promise<void> {
    return this._electronService.invoke(IPC_WAGO_ADS_LOAD, options);
  }

  public disable(): Promise<void> {
    return this._electronService.invoke(IPC_WAGO_ADS_DISABLE);
  }

  /** Passing no rect parks the ad view without unloading the ad page. */
  public setBounds(rect?: AdViewRect): Promise<void> {
    return this._electronService.invoke(IPC_WAGO_ADS_SET_BOUNDS, rect);
  }

  public reload(): Promise<void> {
    return this._electronService.invoke(IPC_WAGO_ADS_RELOAD);
  }

  public openDevTools(): Promise<void> {
    return this._electronService.invoke(IPC_WAGO_ADS_OPEN_DEV_TOOLS);
  }

  public showCmp(): Promise<void> {
    return this._electronService.invoke(IPC_WAGO_ADS_SHOW_CMP);
  }

  public resurfaceCmp(): Promise<void> {
    return this._electronService.invoke(IPC_WAGO_ADS_RESURFACE_CMP);
  }
}
