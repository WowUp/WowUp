import { Component, OnInit } from "@angular/core";
import { MatDialogRef } from "@angular/material/dialog";

@Component({
  selector: "app-telemetry-dialog",
  templateUrl: "./telemetry-dialog.component.html",
  styleUrls: ["./telemetry-dialog.component.scss"],
})
export class TelemetryDialogComponent implements OnInit {
  constructor(public dialogRef: MatDialogRef<TelemetryDialogComponent>) {}

  ngOnInit(): void {}

  onNoClick(): void {
    this.dialogRef.close();
  }
}
