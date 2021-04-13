import { Component, OnInit } from "@angular/core";
import { AgRendererComponent } from "ag-grid-angular";
import { IAfterGuiAttachedParams, ICellRendererParams } from "ag-grid-community";

@Component({
  selector: "app-date-tooltip-cell",
  templateUrl: "./date-tooltip-cell.component.html",
  styleUrls: ["./date-tooltip-cell.component.scss"],
})
export class DateTooltipCellComponent implements AgRendererComponent {
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
