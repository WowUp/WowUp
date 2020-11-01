import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  OnInit,
} from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { TranslateService } from "@ngx-translate/core";
import { UpdateCheckResult } from "electron-updater";
import { forkJoin } from "rxjs";
import { ElectronService } from "../../services";
import { SessionService } from "../../services/session/session.service";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { WowUpService } from "../../services/wowup/wowup.service";

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
    public electronService: ElectronService,
    private _sessionService: SessionService,
    private _snackBar: MatSnackBar,
    private _translateService: TranslateService,
    private _warcraftService: WarcraftService,
    private _wowupService: WowUpService
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

  ngOnInit(): void {
    this._wowupService.wowupUpdateCheck$.subscribe(this.showUpdateSnackbar);
  }

  ngAfterViewInit(): void {
    // check for an app update every hour
    window.setInterval(() => {
      this.checkForAppUpdate();
    }, 60 * 60 * 1000);

    this.checkForAppUpdate();
  }

  onSelectedIndexChange(index: number) {
    this._sessionService.selectedHomeTab = index;
  }

  private async checkForAppUpdate() {
    try {
      const appUpdateResponse = await this._wowupService.checkForAppUpdate();
      console.log(appUpdateResponse);
    } catch (e) {
      console.error(e);
    }
  }

  private showUpdateSnackbar = async (updateCheckResult: UpdateCheckResult) => {
    // Have to wait for the localize service to start
    // const [sbtext, sbaction] = await forkJoin([
    //   this._translateService.get("APP.WOWUP_UPDATE_SNACKBAR_TEXT"),
    //   this._translateService.get("APP.WOWUP_UPDATE_SNACKBAR_ACTION"),
    // ]).toPromise();

    // const snackBarRef = this._snackBar.open(sbtext, sbaction, {
    //   duration: 2000,
    // });

    // snackBarRef.onAction().subscribe(() => {
    //   console.log("The snack-bar action was triggered!");
    // });
  };
}
