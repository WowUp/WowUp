import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  OnInit,
} from "@angular/core";
import { ElectronService } from "app/services";
import { SessionService } from "app/services/session/session.service";
import { WarcraftService } from "app/services/warcraft/warcraft.service";
import { APP_UPDATE_CHECK_FOR_UPDATE } from "common/constants";

@Component({
  selector: "app-home",
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit, AfterViewInit {
  public selectedIndex = 0;
  public hasWowClient = false;

  constructor(
    private _electronService: ElectronService,
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

  ngAfterViewInit(): void {
    this.checkForAppUpdate();
  }

  onSelectedIndexChange(index: number) {
    this._sessionService.selectedHomeTab = index;
  }

  private async checkForAppUpdate() {
    try {
      await this._electronService.invoke(APP_UPDATE_CHECK_FOR_UPDATE);
    } catch (e) {
      console.error(e);
    }
  }
}
