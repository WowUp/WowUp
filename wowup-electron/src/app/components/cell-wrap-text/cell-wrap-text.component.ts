import { Component, OnInit } from "@angular/core";
import { AgRendererComponent } from "ag-grid-angular";
import { ICellRendererParams, IAfterGuiAttachedParams } from "ag-grid-community";

@Component({
  selector: "app-cell-wrap-text",
  templateUrl: "./cell-wrap-text.component.html",
  styleUrls: ["./cell-wrap-text.component.scss"],
})
export class CellWrapTextComponent implements AgRendererComponent {
  public params: ICellRendererParams;

  public constructor() {}

  public agInit(params: ICellRendererParams): void {
    this.params = params;
  }

  public refresh(params: ICellRendererParams): boolean {
    return false;
  }

  public afterGuiAttached?(params?: IAfterGuiAttachedParams): void {}
}
