import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { ElectronService } from "..";
import { IPC_PUSH_NOTIFICATION } from "../../../common/constants";
import { AddonUpdatePushNotification, PushNotification } from "../../../common/wowup/models";

@Injectable({
  providedIn: "root",
})
export class PushService {
  private readonly _addonUpdateSrc = new Subject<AddonUpdatePushNotification[]>();

  public readonly addonUpdate$ = this._addonUpdateSrc.asObservable();

  public constructor(private _electronService: ElectronService) {
    this._electronService.onRendererEvent(IPC_PUSH_NOTIFICATION, (evt, data: PushNotification<any>) => {
      try {
        this.parsePushNotification(data);
      } catch (e) {
        console.error("Failed to handle push notification", e);
      }
    });
  }

  private parsePushNotification(data: PushNotification<any>) {
    switch (data.action) {
      case "addon-update":
        this.parseAddonUpdateNotification(data as PushNotification<AddonUpdatePushNotification[]>);
        break;
      default:
        console.warn("Unhandled push notification", data.action);
    }
  }

  private parseAddonUpdateNotification(note: PushNotification<AddonUpdatePushNotification[]>) {
    if (typeof note.message === "string") {
      note.message = JSON.parse(note.message) as AddonUpdatePushNotification[];
    }

    console.debug("parseAddonUpdateNotification", note);
    this._addonUpdateSrc.next(note.message);
  }
}
