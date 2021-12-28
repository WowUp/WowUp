import { Component } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { MatDialogRef } from "@angular/material/dialog";

export interface ConsentDialogResult {
  telemetry: boolean;
  wagoProvider: boolean;
}

@Component({
  selector: "app-consent-dialog",
  templateUrl: "./consent-dialog.component.html",
  styleUrls: ["./consent-dialog.component.scss"],
})
export class ConsentDialogComponent {
  public consentOptions: FormGroup;

  public constructor(public dialogRef: MatDialogRef<ConsentDialogComponent>) {
    this.consentOptions = new FormGroup({
      telemetry: new FormControl(true),
      wagoProvider: new FormControl(false),
    });
  }

  public onNoClick(): void {
    this.dialogRef.close();
  }

  public onSubmit(evt: any): void {
    evt.preventDefault();

    console.log(this.consentOptions.value);

    this.dialogRef.close(this.consentOptions.value);
  }
}
