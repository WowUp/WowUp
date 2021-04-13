import { ChangeDetectionStrategy, Component, Input, OnDestroy } from "@angular/core";
import { SessionService } from "../../services/session/session.service";
import { from, Subscription } from "rxjs";
import * as ChangeLogJson from "../../../assets/changelog.json";
import { ChangeLog } from "../../models/wowup/change-log";
import { ElectronService } from "../../services";
import { WowUpService } from "../../services/wowup/wowup.service";
import { filter, map } from "rxjs/operators";

@Component({
  selector: "app-about",
  templateUrl: "./about.component.html",
  styleUrls: ["./about.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent implements OnDestroy {
  @Input("tabIndex") public tabIndex: number;

  private _subscriptions: Subscription[] = [];

  public changeLogs: ChangeLog[] = ChangeLogJson.ChangeLogs;
  public versionNumber = from(this.electronService.getVersionNumber());

  public constructor(
    public wowUpService: WowUpService,
    public electronService: ElectronService,
    private _sessionService: SessionService
  ) {
    const tabIndexSub = this._sessionService.selectedHomeTab$
      .pipe(
        filter((newTabIndex) => newTabIndex === this.tabIndex),
        map(() => {
          window.getSelection().empty();
        })
      )
      .subscribe();

    this._subscriptions.push(tabIndexSub);
  }

  public ngOnDestroy(): void {
    this._subscriptions.forEach((subscription) => subscription.unsubscribe());
    this._subscriptions = [];
  }

  public formatChanges(changeLog: ChangeLog): string {
    return changeLog.changes.join("\n");
  }
}
