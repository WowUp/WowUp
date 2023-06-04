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
import { formatDynamicLinks } from "../../../utils/dom.utils";
import { LinkService } from "../../../services/links/link.service";

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
    private _sanitizer: DomSanitizer,
    private _linkService: LinkService
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
    const descriptionContainer: HTMLDivElement = this.changelogContainer?.nativeElement;
    // formatDynamicLinks(descriptionContainer, this.onOpenLink);
  }

  private onOpenLink = (element: HTMLAnchorElement): boolean => {
    // this._linkService.confirmLinkNavigation(element.href).subscribe();

    return false;
  };

  public formatChanges(changeLog: ChangeLog): string {
    return (changeLog.changes ?? []).join("\n");
  }

  public trustHtml(html: string): SafeHtml {
    return this._sanitizer.bypassSecurityTrustHtml(html);
  }
}
