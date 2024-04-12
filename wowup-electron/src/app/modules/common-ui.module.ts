import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { TranslateModule } from "@ngx-translate/core";

import { AlertDialogComponent } from "../components/common/alert-dialog/alert-dialog.component";
import { AnimatedLogoComponent } from "../components/common/animated-logo/animated-logo.component";
import { CellWrapTextComponent } from "../components/common/cell-wrap-text/cell-wrap-text.component";
import { CenteredSnackbarComponent } from "../components/common/centered-snackbar/centered-snackbar.component";
import { ClientSelectorComponent } from "../components/common/client-selector/client-selector.component";
import { ConfirmDialogComponent } from "../components/common/confirm-dialog/confirm-dialog.component";
import { ConsentDialogComponent } from "../components/common/consent-dialog/consent-dialog.component";
import { ExternalUrlConfirmationDialogComponent } from "../components/common/external-url-confirmation-dialog/external-url-confirmation-dialog.component";
import { PatchNotesDialogComponent } from "../components/common/patch-notes-dialog/patch-notes-dialog.component";
import { ProgressButtonComponent } from "../components/common/progress-button/progress-button.component";
import { TelemetryDialogComponent } from "../components/common/telemetry-dialog/telemetry-dialog.component";
import { WebViewComponent } from "../components/common/webview/webview.component";
import { ProgressSpinnerComponent } from "../components/progress-spinner/progress-spinner.component";
import { MatModule } from "./mat-module";
import { PipesModule } from "./pipes.module";
import { ProgressBarComponent } from "../components/common/progress-bar/progress-bar.component";

@NgModule({
  declarations: [
    ProgressSpinnerComponent,
    ProgressButtonComponent,
    ProgressBarComponent,
    ConfirmDialogComponent,
    AlertDialogComponent,
    AnimatedLogoComponent,
    ExternalUrlConfirmationDialogComponent,
    PatchNotesDialogComponent,
    TelemetryDialogComponent,
    ConsentDialogComponent,
    CellWrapTextComponent,
    CenteredSnackbarComponent,
    ClientSelectorComponent,
    WebViewComponent,
  ],
  imports: [CommonModule, FormsModule, TranslateModule, MatModule, PipesModule, ReactiveFormsModule],
  exports: [
    ProgressSpinnerComponent,
    ProgressButtonComponent,
    ProgressBarComponent,
    ConfirmDialogComponent,
    AlertDialogComponent,
    AnimatedLogoComponent,
    ExternalUrlConfirmationDialogComponent,
    PatchNotesDialogComponent,
    TelemetryDialogComponent,
    ConsentDialogComponent,
    CellWrapTextComponent,
    CenteredSnackbarComponent,
    ClientSelectorComponent,
    WebViewComponent,
  ],
})
export class CommonUiModule {}
