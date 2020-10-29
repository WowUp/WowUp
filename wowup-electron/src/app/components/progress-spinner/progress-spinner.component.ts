import { Component, Input, OnInit } from "@angular/core";

@Component({
  selector: "app-progress-spinner",
  templateUrl: "./progress-spinner.component.html",
  styleUrls: ["./progress-spinner.component.scss"],
})
export class ProgressSpinnerComponent implements OnInit {
  @Input("message") message: string;

  constructor() {}

  ngOnInit(): void {}
}
