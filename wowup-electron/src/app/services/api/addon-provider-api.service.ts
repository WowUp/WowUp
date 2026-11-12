import { Injectable } from "@angular/core";

import {
  IPC_ADDON_PROVIDERS_CALL,
  IPC_ADDON_PROVIDERS_INIT,
  IPC_ADDON_PROVIDERS_MATCH,
} from "../../../common/constants";
import {
  AddonProviderCallRequest,
  AddonProviderCallResult,
  AddonProviderConfig,
  AddonProviderDescriptor,
  AddonProviderMatchRequest,
} from "../../../common/models/addon-provider";
import { ElectronService } from "../electron/electron.service";

/** The addon providers that run in main, see `AddonProviderRegistry` */
@Injectable({
  providedIn: "root",
})
export class AddonProviderApiService {
  public constructor(private readonly _electronService: ElectronService) {}

  /** Starts main's providers with this build's config and lists them */
  public init(config: AddonProviderConfig): Promise<AddonProviderDescriptor[]> {
    return this._electronService.invoke(IPC_ADDON_PROVIDERS_INIT, config);
  }

  public call(request: AddonProviderCallRequest): Promise<AddonProviderCallResult> {
    return this._electronService.invoke(IPC_ADDON_PROVIDERS_CALL, request);
  }

  /** Main's providers that claim the url or protocol link, in order */
  public match(request: AddonProviderMatchRequest): Promise<string[]> {
    return this._electronService.invoke(IPC_ADDON_PROVIDERS_MATCH, request);
  }
}
