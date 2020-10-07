import { Component, NgZone, OnInit } from "@angular/core";
import { SessionService } from "app/services/session/session.service";
import { WowUpService } from "app/services/wowup/wowup.service";

@Component({
  selector: "app-footer",
  templateUrl: "./footer.component.html",
  styleUrls: ["./footer.component.scss"],
})
export class FooterComponent implements OnInit {
  constructor(
    private _zone: NgZone,
    public wowUpService: WowUpService,
    public sessionService: SessionService
  ) {}

  ngOnInit(): void {
    // Force the angular zone to pump for every progress update since its outside the zone
    this.sessionService.statusText$.subscribe((text) => {
      this._zone.run(() => {});
    });

    this.sessionService.pageContextText$.subscribe((text) => {
      this._zone.run(() => {});
    });
  }
}
