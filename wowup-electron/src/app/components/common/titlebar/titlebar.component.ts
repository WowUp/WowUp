import { first, from, Subscription } from "rxjs";

import { Component, NgZone, OnDestroy } from "@angular/core";
import { MatLegacySnackBar as MatSnackBar, MatLegacySnackBarRef as MatSnackBarRef } from "@angular/material/legacy-snack-bar";
import { TranslateService } from "@ngx-translate/core";

import {
  IPC_WINDOW_IS_MAXIMIZED,
  IPC_MAXIMIZE_WINDOW,
  IPC_MINIMIZE_WINDOW,
  IPC_WINDOW_ENTER_FULLSCREEN,
  IPC_WINDOW_IS_FULLSCREEN,
  IPC_WINDOW_LEAVE_FULLSCREEN,
} from "../../../../common/constants";
import { AppConfig } from "../../../../environments/environment";
import { ElectronService } from "../../../services/electron/electron.service";
import { WowUpService } from "../../../services/wowup/wowup.service";
import { CenteredSnackbarComponent } from "../../common/centered-snackbar/centered-snackbar.component";

@Component({
  selector: "app-titlebar",
  templateUrl: "./titlebar.component.html",
  styleUrls: ["./titlebar.component.scss"],
})
export class TitlebarComponent implements OnDestroy {
  private _subscriptions: Subscription[] = [];
  private _snackBarRef: MatSnackBarRef<CenteredSnackbarComponent> | undefined;

  public isProd = AppConfig.production;
  public isMaximized = false;
  public isFullscreen = false;

  public constructor(
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

    from(this.electronService.invoke<boolean>(IPC_WINDOW_IS_FULLSCREEN))
      .pipe(first())
      .subscribe((isFullscreen) => {
        this.isFullscreen = isFullscreen;
      });

    from(this.electronService.invoke<boolean>(IPC_WINDOW_IS_MAXIMIZED))
      .pipe(first())
      .subscribe((isMaximized) => {
        this.isMaximized = isMaximized;
      });

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

  public ngOnDestroy(): void {
    this._subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  public async onClickClose(): Promise<void> {
    await this.electronService.closeWindow();
  }

  public async onDblClick(): Promise<void> {
    if (this.electronService.isMac) {
      const action = await this.electronService.getUserDefaultSystemPreference<string>(
        "AppleActionOnDoubleClick",
        "string"
      );

      if (action === "Maximize") {
        await this.electronService.invoke(IPC_MAXIMIZE_WINDOW);
      } else if (action === "Minimize") {
        await this.electronService.invoke(IPC_MINIMIZE_WINDOW);
      }
    }
  }
}
