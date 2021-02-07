import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import {
  ALLIANCE_LIGHT_THEME,
  ALLIANCE_THEME,
  DEFAULT_LIGHT_THEME,
  DEFAULT_THEME,
  HORDE_LIGHT_THEME,
  HORDE_THEME,
  IPC_MAXIMIZE_WINDOW,
  IPC_MINIMIZE_WINDOW,
  IPC_WINDOW_ENTER_FULLSCREEN,
  IPC_WINDOW_LEAVE_FULLSCREEN,
} from "../../../common/constants";
import { Subscription } from "rxjs";
import { AppConfig } from "../../../environments/environment";
import { ElectronService } from "../../services/electron/electron.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { MatSnackBar, MatSnackBarRef } from "@angular/material/snack-bar";
import { CenteredSnackbarComponent } from "../centered-snackbar/centered-snackbar.component";
import { TranslateService } from "@ngx-translate/core";

@Component({
  selector: "app-titlebar",
  templateUrl: "./titlebar.component.html",
  styleUrls: ["./titlebar.component.scss"],
})
export class TitlebarComponent implements OnInit, OnDestroy {
  public isProd = AppConfig.production;
  public isMaximized = false;

  private _subscriptions: Subscription[] = [];
  private _snackBarRef: MatSnackBarRef<CenteredSnackbarComponent>;

  public isFullscreen = false;

  constructor(
    public electronService: ElectronService,
    private _wowUpService: WowUpService,
    private _ngZone: NgZone,
    private _snackBar: MatSnackBar,
    private _translateService: TranslateService
  ) {
    const windowMaximizedSubscription = this.electronService.windowMaximized$.subscribe((maximized) => {
      this._ngZone.run(() => (this.isMaximized = maximized));
    });

    this._subscriptions = [windowMaximizedSubscription];

    this.electronService.on(IPC_WINDOW_ENTER_FULLSCREEN, () => {
      this.isFullscreen = true;
      const localeKey = this.electronService.isMac ? "APP.FULLSCREEN_SNACKBAR.MAC" : "APP.FULLSCREEN_SNACKBAR.WINDOWS";
      const message = this._translateService.instant(localeKey);
      this._snackBarRef = this._snackBar.openFromComponent(CenteredSnackbarComponent, {
        duration: 5000,
        panelClass: ["wowup-snackbar", "text-1"],
        data: {
          message,
        },
        verticalPosition: "top",
      });
    });

    this.electronService.on(IPC_WINDOW_LEAVE_FULLSCREEN, () => {
      this.isFullscreen = false;
      this._snackBarRef?.dismiss();
      this._snackBarRef = undefined;
    });
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this._subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  getLogoPath() {
    switch (this._wowUpService.currentTheme) {
      case HORDE_THEME:
      case HORDE_LIGHT_THEME:
        return "assets/images/horde-1.png";
      case ALLIANCE_THEME:
      case ALLIANCE_LIGHT_THEME:
        return "assets/images/alliance-1.png";
      case DEFAULT_THEME:
      case DEFAULT_LIGHT_THEME:
      default:
        return "assets/images/wowup-white-1.png";
    }
  }

  onClickClose() {
    this.electronService.closeWindow();
  }

  onDblClick() {
    if (this.electronService.isMac) {
      const action = this.electronService.getUserDefaultSystemPreference(
        "AppleActionOnDoubleClick",
        "string"
      ) as string;

      if (action === "Maximize") {
        this.electronService.invoke(IPC_MAXIMIZE_WINDOW);
      } else if (action === "Minimize") {
        this.electronService.invoke(IPC_MINIMIZE_WINDOW);
      }
    }
  }
}
