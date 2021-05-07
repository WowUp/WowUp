import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { SessionService } from "app/services/session/session.service";
import { ElectronService } from "../../services";
import { WowUpService } from "../../services/wowup/wowup.service";

@Component({
  selector: "app-options",
  templateUrl: "./options.component.html",
  styleUrls: ["./options.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionsComponent {
  @Input("tabIndex") public tabIndex: number;

  public selectedOptionsTab$ = this._sessionService.selectedOptionsTab$;

  public tabListItems = [
    { label: "PAGES.OPTIONS.TABS.CLIENTS" },
    { label: "PAGES.OPTIONS.TABS.ACCOUNT" },
    { label: "PAGES.OPTIONS.TABS.APPLICATION" },
    { label: "PAGES.OPTIONS.TABS.ADDONS" },
    { label: "PAGES.OPTIONS.TABS.DEBUG" },
  ];

  public constructor(
    public wowUpService: WowUpService,
    public electronService: ElectronService,
    private _sessionService: SessionService
  ) {}

  public onSelectedIndexChange(index: number): void {
    this._sessionService.selectedOptionsTab = index;
  }
}
