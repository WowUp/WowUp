import { Injectable } from "@angular/core";
import { ipcRenderer } from "electron";
import {
  START_NOTIFICATION_SERVICE,
  NOTIFICATION_SERVICE_STARTED,
  NOTIFICATION_SERVICE_ERROR,
  NOTIFICATION_RECEIVED as ON_NOTIFICATION_RECEIVED,
  TOKEN_UPDATED,
} from "electron-push-receiver/src/constants";
import { AppConfig } from "environments/environment";

@Injectable({
  providedIn: "root",
})
export class PushService {
  public constructor() {
    // Listen for service successfully started
    ipcRenderer.on(NOTIFICATION_SERVICE_STARTED, (_, token) => {
      console.debug("NOTIFICATION_SERVICE_STARTED", token);
    });

    // Handle notification errors
    ipcRenderer.on(NOTIFICATION_SERVICE_ERROR, (_, error) => {
      console.debug("NOTIFICATION_SERVICE_ERROR", error);
    });

    // Send FCM token to backend
    ipcRenderer.on(TOKEN_UPDATED, (_, token) => {
      console.debug("TOKEN_UPDATED", token);
    });

    // Display notification
    ipcRenderer.on(ON_NOTIFICATION_RECEIVED, (_, notification) => {
      console.debug("ON_NOTIFICATION_RECEIVED", notification);
    });

    // Start service
    console.debug("START_NOTIFICATION_SERVICE", AppConfig.firebaseSenderId);
    ipcRenderer.send(START_NOTIFICATION_SERVICE, AppConfig.firebaseSenderId);
  }
}
