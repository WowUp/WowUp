import { Component, OnInit } from "@angular/core";

import { BattleNetRegion } from "../../../common/battle-net/battle-net.common";
import { BattleNetService } from "../../services/battle-net/battle-net.service";

@Component({
  selector: "app-battle-net-login",
  templateUrl: "./battle-net-login.component.html",
  styleUrls: ["./battle-net-login.component.scss"],
})
export class BattleNetLoginComponent implements OnInit {
  public isBusy = false;
  public displayName = "";
  public selectedRegion: BattleNetRegion = "US";

  public constructor(private _battleNetService: BattleNetService) {}

  public ngOnInit(): void {}

  public onClickLogin(): void {
    this._battleNetService.signIn(this.selectedRegion).catch(console.error);
  }
}
