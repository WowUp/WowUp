import { BehaviorSubject, from } from "rxjs";
import { filter, map, switchMap } from "rxjs/operators";

import { Injectable } from "@angular/core";

import {
  ACCT_FEATURE_KEYS,
  ACCT_PUSH_ENABLED_KEY,
  APP_PROTOCOL_NAME,
  FEATURE_ACCOUNTS_ENABLED,
  IPC_PUSH_INIT,
  IPC_PUSH_REGISTER,
  IPC_PUSH_SUBSCRIBE,
  IPC_PUSH_UNREGISTER,
  STORAGE_WOWUP_AUTH_TOKEN,
} from "../../../common/constants";
import { AppConfig } from "../../../environments/environment";
import { getProtocol } from "../../utils/string.utils";
import { ElectronService } from "../electron/electron.service";
import { LinkService } from "../links/link.service";
import { PreferenceStorageService } from "../storage/preference-storage.service";
import { WowUpApiService } from "../wowup-api/wowup-api.service";
import { HttpErrorResponse } from "@angular/common/http";
import { WowUpGetAccountResponse } from "wowup-lib-core";

@Injectable({
  providedIn: "root",
})
export class WowUpAccountService {
  public readonly wowUpAuthTokenSrc = new BehaviorSubject<string>("");
  public readonly wowUpAccountSrc = new BehaviorSubject<WowUpGetAccountResponse | undefined>(undefined);
  public readonly accountPushSrc = new BehaviorSubject<boolean>(false);

  public async getAccountPushEnabled(): Promise<boolean> {
    const pref = await this._preferenceStorageService.getAsync(ACCT_PUSH_ENABLED_KEY);
    return pref === "true";
  }

  public async setAccountPushEnabled(enabled: boolean) {
    await this._preferenceStorageService.setAsync(ACCT_PUSH_ENABLED_KEY, enabled);
  }

  public get authToken(): string {
    return this.wowUpAuthTokenSrc.value;
  }

  public get account(): WowUpGetAccountResponse | undefined {
    return this.wowUpAccountSrc.value;
  }

  public constructor(
    private _electronService: ElectronService,
    private _linkService: LinkService,
    private _preferenceStorageService: PreferenceStorageService,
    private _wowUpApiService: WowUpApiService
  ) {
    if (!FEATURE_ACCOUNTS_ENABLED) {
      return;
    }

    this.wowUpAuthTokenSrc
      .pipe(
        filter((token) => !!token && token.length > 10),
        switchMap((token) => from(this.onAuthTokenChanged(token)))
      )
      .subscribe();

    this._electronService.customProtocol$
      .pipe(
        filter((protocol) => !!protocol),
        map((protocol) => this.handleLoginProtocol(protocol))
      )
      .subscribe();

    this.loadAuthToken();

    this.getAccountPushEnabled()
      .then((pushEnabled) => {
        console.debug("accountPushEnabled", pushEnabled);
        if (pushEnabled) {
          this.initializePush().catch((e) => console.error(e));
          this.accountPushSrc.next(true);
        }
      })
      .catch(console.error);
  }

  public login(): void {
    this._linkService
      .openExternalLink(`${AppConfig.wowUpWebsiteUrl}/login?client=desktop`)
      .catch((e) => console.error(e));
  }

  public logout(): void {
    this.clearAuthToken();
    this.resetAccountPreferences().catch(console.error);
  }

  private onAuthTokenChanged = async (token: string) => {
    try {
      const account = await this._wowUpApiService.getAccount(token);
      console.debug("Account", account);
      this.wowUpAccountSrc.next(account);

      const pushEnabled = await this.getAccountPushEnabled();
      if (pushEnabled) {
        await this.toggleAccountPush(true);
      }
    } catch (e) {
      console.error(e);

      // Check if user is no longer authorized
      if (e instanceof HttpErrorResponse && [403, 401].includes(e.status)) {
        this.logout();
      }
    }
  };

  private clearAuthToken(): void {
    window.localStorage.removeItem(STORAGE_WOWUP_AUTH_TOKEN);
    this.wowUpAuthTokenSrc.next("");
    this.wowUpAccountSrc.next(undefined);
  }

  private loadAuthToken(): void {
    const storedToken = window.localStorage.getItem(STORAGE_WOWUP_AUTH_TOKEN);
    if (storedToken) {
      console.debug("loaded auth token", storedToken);
      this.wowUpAuthTokenSrc.next(storedToken);
    }
  }

  /**
   * Handle the post login protocol message
   * wowup://login/desktop/#{token}
   */
  private handleLoginProtocol = (protocol: string): void => {
    const protocolName = getProtocol(protocol);
    if (protocolName !== APP_PROTOCOL_NAME) {
      return;
    }

    const parts = protocol.split("/");
    if (parts[2] !== "login" || parts[3] !== "desktop") {
      return;
    }

    const token = parts[4];
    if (typeof token !== "string" || token.length < 10) {
      console.warn("Invalid auth token", protocol);
      return;
    }

    console.debug("GOT WOWUP PROTOCOL", protocol);
    window.localStorage.setItem(STORAGE_WOWUP_AUTH_TOKEN, token);
    this.wowUpAuthTokenSrc.next(token);
  };

  // ACCOUNT FEATURES
  public async toggleAccountPush(enabled: boolean): Promise<void> {
    try {
      if (enabled) {
        await this.initializePush();
        await this.registerForPush(this.authToken, this.account.config.pushAppId);

        if (this.account.config?.pushChannels?.addonUpdates) {
          await this.subscribe(this.account.config.pushChannels.addonUpdates);
        }
      } else {
        await this.unregisterForPush(this.authToken, this.account.config.pushAppId);
      }

      await this.setAccountPushEnabled(enabled);
    } catch (e) {
      console.error("Failed to toggle account push", e);
      throw e;
    }
  }

  // LOCAL PREFERENCES
  private async resetAccountPreferences(): Promise<void> {
    for (const key of ACCT_FEATURE_KEYS) {
      await this._preferenceStorageService.setAsync(key, false);
    }
  }

  // PUSH
  public async initializePush(): Promise<boolean> {
    return await this._electronService.invoke(IPC_PUSH_INIT);
  }

  public async registerForPush(authToken: string, pushAppId: string): Promise<string> {
    const pushToken = await this._electronService.invoke<string>(IPC_PUSH_REGISTER, pushAppId);
    await this._wowUpApiService.registerPushToken(authToken, pushToken, this._electronService.platform);
    return pushToken;
  }

  public async unregisterForPush(authToken: string, pushAppId: string): Promise<void> {
    const pushToken = await this._electronService.invoke<string>(IPC_PUSH_REGISTER, pushAppId);
    await this._electronService.invoke(IPC_PUSH_UNREGISTER);
    await this._wowUpApiService.removePushToken(authToken, pushToken);
  }

  private async subscribe(channel: string): Promise<void> {
    await this._electronService.invoke(IPC_PUSH_SUBSCRIBE, channel);
  }
}
