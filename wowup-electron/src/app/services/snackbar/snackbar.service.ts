import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { TranslateService } from "@ngx-translate/core";
import {
  CenteredSnackbarComponent,
  CenteredSnackbarComponentData,
} from "../../components/centered-snackbar/centered-snackbar.component";

@Injectable({
  providedIn: "root",
})
export class SnackbarService {
  constructor(private _translateService: TranslateService, private _snackBar: MatSnackBar) {}

  public showSuccessSnackbar(localeKey: string, classes: string[] = []) {
    this.showSnackbar(localeKey, [...classes, "snackbar-success"]);
  }

  public showErrorSnackbar(localeKey: string, classes: string[] = []) {
    this.showSnackbar(localeKey, [...classes, "snackbar-error"]);
  }

  public showSnackbar(localeKey: string, classes: string[] = []) {
    const message = this._translateService.instant(localeKey);
    const data: CenteredSnackbarComponentData = {
      message,
    };
    this._snackBar.openFromComponent(CenteredSnackbarComponent, {
      duration: 5000,
      panelClass: ["wowup-snackbar", "text-1", ...classes],
      data,
    });
  }
}
