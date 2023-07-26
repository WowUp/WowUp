import { from, Subscription } from "rxjs";
import { filter, map } from "rxjs/operators";

import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
} from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

import { ChangeLog } from "../../../models/wowup/change-log";
import { ElectronService } from "../../../services";
import { SessionService } from "../../../services/session/session.service";
import { WowUpService } from "../../../services/wowup/wowup.service";
import { PatchNotesService } from "../../../services/wowup/patch-notes.service";

@Component({
  selector: "app-about",
  templateUrl: "./about.component.html",
  styleUrls: ["./about.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent implements OnDestroy, AfterViewChecked {
  @Input("tabIndex") public tabIndex!: number;

  @ViewChild("changelogContainer", { read: ElementRef }) public changelogContainer!: ElementRef;

  private _subscriptions: Subscription[] = [];

  public changeLogs: ChangeLog[] = [];
  public versionNumber = from(this.electronService.getVersionNumber());

  public constructor(
    public wowUpService: WowUpService,
    public electronService: ElectronService,
    private _sessionService: SessionService,
    private _patchNotesService: PatchNotesService,
    private _sanitizer: DomSanitizer
  ) {
    this.changeLogs = this._patchNotesService.changeLogs;
    const tabIndexSub = this._sessionService.selectedHomeTab$
      .pipe(
        filter((newTabIndex) => newTabIndex === this.tabIndex),
        map(() => {
          window.getSelection()?.empty();
        })
      )
      .subscribe();

    this._subscriptions.push(tabIndexSub);
  }

  public ngOnDestroy(): void {
    this._subscriptions.forEach((subscription) => subscription.unsubscribe());
    this._subscriptions = [];
  }

  public ngAfterViewChecked(): void {
    // formatDynamicLinks(descriptionContainer, this.onOpenLink);
  }

  public formatChanges(changeLog: ChangeLog): string {
    return (changeLog.changes ?? []).join("\n");
  }

  public trustHtml(html: string): SafeHtml {
    return this._sanitizer.bypassSecurityTrustHtml(html);
  }
}
