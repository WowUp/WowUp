import { Component } from "@angular/core";
import { MatLegacyDialogRef as MatDialogRef } from "@angular/material/legacy-dialog";

@Component({
  selector: "app-telemetry-dialog",
  templateUrl: "./telemetry-dialog.component.html",
  styleUrls: ["./telemetry-dialog.component.scss"],
})
export class TelemetryDialogComponent {
  public constructor(public dialogRef: MatDialogRef<TelemetryDialogComponent>) {}

  public onNoClick(): void {
    this.dialogRef.close();
  }
}
