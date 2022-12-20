import { BehaviorSubject } from "rxjs";

import { Injectable } from "@angular/core";

import { IPC_GET_ZOOM_FACTOR, IPC_SET_ZOOM_FACTOR, ZOOM_FACTOR_KEY } from "../../../common/constants";
import { ZOOM_SCALE, ZoomDirection } from "../../utils/zoom.utils";
import { ElectronService } from "../electron/electron.service";
import { PreferenceStorageService } from "../storage/preference-storage.service";

@Injectable({
  providedIn: "root",
})
export class ZoomService {
  private readonly _zoomFactorChangeSrc = new BehaviorSubject(1.0);

  public readonly zoomFactor$ = this._zoomFactorChangeSrc.asObservable();

  public constructor(
    private _electronService: ElectronService,
    private _preferenceStorageService: PreferenceStorageService
  ) {
    this.getZoomFactor()
      .then((zoom) => this._zoomFactorChangeSrc.next(zoom))
      .catch(() => console.error("Failed to set initial zoom"));

    window.wowup.onRendererEvent("zoom-changed", (_evt, zoomDirection: string) => {
      this.onWindowZoomChanged(zoomDirection).catch((e) => console.error(e));
    });
  }

  public getZoomFactor(): Promise<number> {
    return this._electronService.invoke(IPC_GET_ZOOM_FACTOR);
  }

  public setZoomFactor = async (zoomFactor: number): Promise<void> => {
    await this._electronService.invoke(IPC_SET_ZOOM_FACTOR, zoomFactor);
    this._zoomFactorChangeSrc.next(zoomFactor);
  };

  private async onWindowZoomChanged(zoomDirection: string) {
    if (zoomDirection === "in") {
      const factor = await this.getNextZoomInFactor();
      await this.setZoomFactor(factor);
    } else if (zoomDirection === "out") {
      const factor = await this.getNextZoomOutFactor();
      await this.setZoomFactor(factor);
    }
  }

  public applyZoom = async (zoomDirection: ZoomDirection): Promise<void> => {
    switch (zoomDirection) {
      case ZoomDirection.ZoomIn:
        await this.setZoomFactor(await this.getNextZoomInFactor());
        break;
      case ZoomDirection.ZoomOut:
        await this.setZoomFactor(await this.getNextZoomOutFactor());
        break;
      case ZoomDirection.ZoomReset:
        await this.setZoomFactor(1.0);
        break;
      case ZoomDirection.ZoomUnknown:
      default:
        break;
    }
  };

  private async getNextZoomInFactor(): Promise<number> {
    const windowZoomFactor = await this.getZoomFactor();
    const zoomFactor = Math.round(windowZoomFactor * 100) / 100;
    let zoomIndex = ZOOM_SCALE.indexOf(zoomFactor);
    if (zoomIndex == -1) {
      return 1.0;
    }
    zoomIndex = Math.min(zoomIndex + 1, ZOOM_SCALE.length - 1);
    return ZOOM_SCALE[zoomIndex];
  }

  private async getNextZoomOutFactor(): Promise<number> {
    const windowZoomFactor = await this.getZoomFactor();
    const zoomFactor = Math.round(windowZoomFactor * 100) / 100;
    let zoomIndex = ZOOM_SCALE.indexOf(zoomFactor);
    if (zoomIndex == -1) {
      return 1.0;
    }
    zoomIndex = Math.max(zoomIndex - 1, 0);
    return ZOOM_SCALE[zoomIndex];
  }
}
