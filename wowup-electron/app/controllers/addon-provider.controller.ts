import {
  IPC_ADDON_PROVIDERS_CALL,
  IPC_ADDON_PROVIDERS_INIT,
  IPC_ADDON_PROVIDERS_MATCH,
} from "../../src/common/constants";
import {
  AddonProviderCallRequest,
  AddonProviderCallResult,
  AddonProviderConfig,
  AddonProviderDescriptor,
  AddonProviderMatchRequest,
} from "../../src/common/models/addon-provider";
import { AddonProviderRegistry } from "../services/addon-providers/addon-provider-registry";
import { ipcHandle, IpcController } from "./ipc-controller";

const NOT_READY: AddonProviderCallResult = {
  ok: false,
  error: { kind: "error", name: "Error", message: "Addon providers are not initialized" },
};

export class AddonProviderController implements IpcController {
  private _registry: AddonProviderRegistry | undefined;

  /** Builds the registry once the renderer has sent its config, see `AddonProviderConfig` */
  public constructor(private readonly _createRegistry: (config: AddonProviderConfig) => AddonProviderRegistry) {}

  public register(): void {
    // A renderer reload sends this again; the fresh registry also drops the old one's caches and breakers
    ipcHandle(IPC_ADDON_PROVIDERS_INIT, (_evt, config: AddonProviderConfig): AddonProviderDescriptor[] => {
      this._registry = this._createRegistry(config);
      return this._registry.getDescriptors();
    });
    ipcHandle(IPC_ADDON_PROVIDERS_CALL, (_evt, request: AddonProviderCallRequest) =>
      this._registry ? this._registry.call(request) : NOT_READY,
    );
    ipcHandle(IPC_ADDON_PROVIDERS_MATCH, (_evt, request: AddonProviderMatchRequest) =>
      this._registry ? this._registry.match(request) : [],
    );
  }
}
