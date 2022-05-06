import { Component, OnDestroy } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { AgRendererComponent } from "ag-grid-angular";
import { ICellRendererParams } from "ag-grid-community";
import { BehaviorSubject, combineLatest, Subject, takeUntil, timer } from "rxjs";
import { ElectronService } from "../../../services";
import { getRelativeDateFormat } from "../../../utils/string.utils";

@Component({
  selector: "app-date-tooltip-cell",
  templateUrl: "./date-tooltip-cell.component.html",
  styleUrls: ["./date-tooltip-cell.component.scss"],
})
export class DateTooltipCellComponent implements AgRendererComponent, OnDestroy {
  private readonly _destroy$: Subject<boolean> = new Subject<boolean>();

  public params!: ICellRendererParams;
  public time$ = new BehaviorSubject<string>(new Date().toISOString());
  public relativeTime$ = new BehaviorSubject<string>("");

  public constructor(private _translateService: TranslateService, private _electronService: ElectronService) {}

  public agInit(params: ICellRendererParams): void {
    this.params = params;

    this.time$.next(this.params.value as string);

    combineLatest([this._electronService.windowFocused$, timer(0, 30000)])
      .pipe(takeUntil(this._destroy$))
      .subscribe(([focused]) => {
        if (!focused && this.relativeTime$.value.length > 0) {
          return;
        }

        const [fmt, val] = getRelativeDateFormat(this.params.value as string);
        if (!fmt) {
          return this.relativeTime$.next("ERR");
        }
        this.relativeTime$.next(this._translateService.instant(fmt, val) as string);
      });
  }

  public ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  public refresh(): boolean {
    return false;
  }

  public afterGuiAttached?(): void {}
}
