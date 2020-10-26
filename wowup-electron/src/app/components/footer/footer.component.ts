import { Component, NgZone, OnInit } from "@angular/core";
import { SessionService } from "../../services/session/session.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { Observable } from "rxjs";
import { filter, map } from "rxjs/operators";

@Component({
  selector: "app-footer",
  templateUrl: "./footer.component.html",
  styleUrls: ["./footer.component.scss"],
})
export class FooterComponent implements OnInit {
  public hasUpdate$: Observable<boolean>;

  public isUpdatingWowUp = false;

  constructor(
    private _zone: NgZone,
    public wowUpService: WowUpService,
    public sessionService: SessionService
  ) {
    this.hasUpdate$ = this.sessionService.wowupUpdateInfo$.pipe(
      map((info) => !!info)
    );
  }

  ngOnInit(): void {
    // Force the angular zone to pump for every progress update since its outside the zone
    this.sessionService.statusText$.subscribe((text) => {
      this._zone.run(() => {});
    });

    this.sessionService.pageContextText$.subscribe((text) => {
      this._zone.run(() => {});
    });
  }

  public async onClickUpdateWowup() {
    this.isUpdatingWowUp = true;
    try {
      const result = await this.wowUpService.downloadUpdate();
      console.debug("onClickUpdateWowup", result);

      await this.wowUpService.installUpdate();
    } catch (e) {
      console.error("onClickUpdateWowup", e);
    } finally {
      this.isUpdatingWowUp = false;
    }
  }
}
