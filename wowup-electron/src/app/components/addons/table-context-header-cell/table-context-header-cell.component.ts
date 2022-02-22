import { IHeaderAngularComp } from "ag-grid-angular";
import { IHeaderParams } from "ag-grid-community";
import { BehaviorSubject } from "rxjs";

import { Component, NgZone } from "@angular/core";

import { SessionService } from "../../../services/session/session.service";

interface HeaderParams extends IHeaderParams {
  menuIcon: string;
  onHeaderContext: (event: MouseEvent) => void;
}

@Component({
  selector: "app-table-context-header-cell",
  templateUrl: "./table-context-header-cell.component.html",
  styleUrls: ["./table-context-header-cell.component.scss"],
  host: {
    class: "ag-cell-label-container",
  },
})
export class TableContextHeaderCellComponent implements IHeaderAngularComp {
  public params!: HeaderParams;
  public sorted$ = new BehaviorSubject<string>("");

  public constructor(private _ngZone: NgZone, private _sessionService: SessionService) {}

  public agInit(params: HeaderParams): void {
    this.params = params;
    this.params.column.addEventListener("sortChanged", this.onSortChanged);
    this.onSortChanged();
  }

  public refresh(): boolean {
    return false;
  }

  public afterGuiAttached?(): void {}

  public onSortRequested(event: KeyboardEvent): void {
    if (this.params.enableSorting !== true) {
      return;
    }

    const nextSort = this.getNextSort(this.sorted$.value);
    this.params.setSort(nextSort, event.shiftKey);
  }

  private getNextSort(sorted: string): "asc" | "desc" | null {
    switch (sorted) {
      case "asc":
        return "desc";
      case "desc":
        return null;
      default:
        return "asc";
    }
  }

  private onSortChanged = () => {
    if (this.params.column.isSortAscending()) {
      this.sorted$.next("asc");
    } else if (this.params.column.isSortDescending()) {
      this.sorted$.next("desc");
    } else {
      this.sorted$.next("");
    }
  };
}
