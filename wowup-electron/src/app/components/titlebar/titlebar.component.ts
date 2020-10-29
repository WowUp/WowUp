import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { platform } from "os";
import { Subscription } from "rxjs";
import { AppConfig } from "../../../environments/environment";
import { ElectronService } from "../../services/electron/electron.service";
import { WowUpService } from "../../services/wowup/wowup.service";

@Component({
  selector: "app-titlebar",
  templateUrl: "./titlebar.component.html",
  styleUrls: ["./titlebar.component.scss"],
})
export class TitlebarComponent implements OnInit, OnDestroy {
  // TODO use electron service
  public isMac = platform() === "darwin";
  public isWindows = platform() === "win32";
  public isLinux = platform() === "linux";
  public userAgent = platform();
  public isProd = AppConfig.production;
  public isMaximized = false;

  private _subscriptions: Subscription[] = [];

  constructor(
    public electronService: ElectronService,
    private _wowUpService: WowUpService,
    private _ngZone: NgZone
  ) {
    const windowMaximizedSubscription = this.electronService.windowMaximized$.subscribe(
      (maximized) => {
        this._ngZone.run(() => (this.isMaximized = maximized));
      }
    );

    this._subscriptions = [windowMaximizedSubscription];
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this._subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  onClickClose() {
    if (this._wowUpService.collapseToTray) {
      this.electronService.hideWindow();
    } else {
      this.electronService.closeWindow();
    }
  }

  onClickDebug() {
    this.electronService.remote.getCurrentWebContents().openDevTools();
  }

  onDblClick() {
    const win = this.electronService.remote.getCurrentWindow();

    if (this.isMac) {
      const action = this.electronService.remote.systemPreferences.getUserDefault(
        "AppleActionOnDoubleClick",
        "string"
      );
      if (action === "Maximize") {
        if (win.isMaximized()) {
          win.unmaximize();
        } else {
          win.maximize();
        }
      } else if (action === "Minimize") {
        win.minimize();
      }
    }
  }
}
