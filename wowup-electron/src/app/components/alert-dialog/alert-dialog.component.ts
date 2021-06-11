import { Component, Inject } from "@angular/core";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";

export interface AlertDialogData {
  title: string;
  message: string;
}

@Component({
  selector: "app-alert-dialog",
  templateUrl: "./alert-dialog.component.html",
  styleUrls: ["./alert-dialog.component.scss"],
})
export class AlertDialogComponent {
  public constructor(
    public dialogRef: MatDialogRef<AlertDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AlertDialogData
  ) {}
}
