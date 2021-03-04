import { Component, NgZone } from "@angular/core";
import { IHeaderAngularComp } from "ag-grid-angular";
import { IHeaderParams, IAfterGuiAttachedParams } from "ag-grid-community";
import { SessionService } from "../../services/session/session.service";
import { BehaviorSubject } from "rxjs";

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
  public params: HeaderParams;
  public sorted$ = new BehaviorSubject<string>("");

  public constructor(private _ngZone: NgZone, private _sessionService: SessionService) {}

  public agInit(params: HeaderParams): void {
    this.params = params;
    this.params.column.addEventListener("sortChanged", this.onSortChanged);
    console.debug("onHeaderContext", params.onHeaderContext);
    this.onSortChanged();
  }

  public refresh(params: IHeaderParams): boolean {
    return false;
  }

  public afterGuiAttached?(params?: IAfterGuiAttachedParams): void {}

  public onSortRequested(event: KeyboardEvent): void {
    if (this.params.enableSorting !== true) {
      return;
    }

    const nextSort = this.getNextSort(this.sorted$.value);
    console.debug("onSortRequested", nextSort);
    this.params.setSort(nextSort, event.shiftKey);
  }

  private getNextSort(sorted: string): string {
    switch (sorted) {
      case "asc":
        return "desc";
      case "desc":
        return "";
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
    console.debug("onSortChanged", this.params.displayName, this.sorted$.value);
  };
}
