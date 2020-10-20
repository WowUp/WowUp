import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";
import { SessionService } from "app/services/session/session.service";
import { WarcraftService } from "app/services/warcraft/warcraft.service";

@Component({
  selector: "app-home",
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit {
  public selectedIndex = 0;
  public hasWowClient = false;

  constructor(
    private _sessionService: SessionService,
    private _warcraftService: WarcraftService
  ) {
    this._warcraftService.installedClientTypes$.subscribe((clientTypes) => {
      if (clientTypes === undefined) {
        this.hasWowClient = false;
        this.selectedIndex = 3;
      } else {
        this.hasWowClient = clientTypes.length > 0;
        this.selectedIndex = this.hasWowClient ? 0 : 3;
      }
    });
  }

  ngOnInit(): void {}

  onSelectedIndexChange(index: number) {
    this._sessionService.selectedHomeTab = index;
  }
}
