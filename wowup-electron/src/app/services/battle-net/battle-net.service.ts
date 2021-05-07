import { Injectable } from "@angular/core";

import { AppConfig } from "../../../environments/environment";
import {
  BattleNetRegion,
  IPC_BATTLE_NET_LOGIN,
  BATTLE_NET_SIGN_IN_REDIRECT_URL,
} from "../../../common/battle-net/battle-net.common";
import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class BattleNetService {
  public constructor(private _electronService: ElectronService) {}

  public async signIn(region: BattleNetRegion): Promise<boolean> {
    const signInUrl = this.getSignInUrl(region);
    await this._electronService.openExternal(signInUrl, { activate: true });
    // const response = await this._electronService.invoke(IPC_BATTLE_NET_LOGIN, signInUrl);
    return false;
  }

  private getSignInUrl(region: BattleNetRegion): string {
    const url = new URL(`${AppConfig.wowUpApiUrl}/battle-net/${region.toLowerCase()}/signin`);
    url.searchParams.set("client", "app");
    return url.toString();
  }
}
