import { Component, Inject, OnInit } from "@angular/core";
import { MAT_SNACK_BAR_DATA } from "@angular/material/snack-bar";

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

  constructor(@Inject(MAT_SNACK_BAR_DATA) public data: CenteredSnackbarComponentData) {}

  ngOnInit(): void {
    this.message = this.data.message;
  }
}
