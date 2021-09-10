import { Component } from "@angular/core";
import { AgRendererComponent } from "ag-grid-angular";
import { ICellRendererParams } from "ag-grid-community";

@Component({
  selector: "app-cell-wrap-text",
  templateUrl: "./cell-wrap-text.component.html",
  styleUrls: ["./cell-wrap-text.component.scss"],
})
export class CellWrapTextComponent implements AgRendererComponent {
  public params!: ICellRendererParams;

  public constructor() {}

  public agInit(params: ICellRendererParams): void {
    this.params = params;
  }

  public refresh(): boolean {
    return false;
  }

  public afterGuiAttached?(): void {}
}
