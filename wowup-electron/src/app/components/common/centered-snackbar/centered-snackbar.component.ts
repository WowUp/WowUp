import { Component, Inject, OnInit } from "@angular/core";
import { MAT_LEGACY_SNACK_BAR_DATA as MAT_SNACK_BAR_DATA } from "@angular/material/legacy-snack-bar";

export interface CenteredSnackbarComponentData {
  message: string;
}

@Component({
  selector: "app-centered-snackbar",
  templateUrl: "./centered-snackbar.component.html",
  styleUrls: ["./centered-snackbar.component.scss"],
})
export class CenteredSnackbarComponent implements OnInit {
  public message?: string;

  public constructor(@Inject(MAT_SNACK_BAR_DATA) public data: CenteredSnackbarComponentData) {}

  public ngOnInit(): void {
    this.message = this.data.message;
  }
}
