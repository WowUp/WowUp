import { Injectable } from "@angular/core";
import { MatSnackBar, MatSnackBarRef } from "@angular/material/snack-bar";
import { TranslateService } from "@ngx-translate/core";
import {
  CenteredSnackbarComponent,
  CenteredSnackbarComponentData,
} from "../../components/centered-snackbar/centered-snackbar.component";

export interface SnackbarConfig {
  timeout?: number;
  classes?: string[];
}

@Injectable({
  providedIn: "root",
})
export class SnackbarService {
  constructor(private _translateService: TranslateService, private _snackBar: MatSnackBar) {}

  public showSuccessSnackbar(localeKey: string, config?: SnackbarConfig): MatSnackBarRef<CenteredSnackbarComponent> {
    return this.showSnackbar(localeKey, {
      ...config,
      classes: [...(config?.classes ?? []), "snackbar-success"],
    });
  }

  public showErrorSnackbar(localeKey: string, config?: SnackbarConfig): MatSnackBarRef<CenteredSnackbarComponent> {
    return this.showSnackbar(localeKey, {
      ...config,
      classes: [...(config?.classes ?? []), "snackbar-error"],
    });
  }

  public showSnackbar(localeKey: string, config?: SnackbarConfig): MatSnackBarRef<CenteredSnackbarComponent> {
    const message = this._translateService.instant(localeKey);
    const data: CenteredSnackbarComponentData = {
      message,
    };
    return this._snackBar.openFromComponent(CenteredSnackbarComponent, {
      duration: config?.timeout ?? 5000,
      panelClass: ["wowup-snackbar", "text-1", ...(config?.classes ?? [])],
      data,
    });
  }
}
