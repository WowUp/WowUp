import { IPC_PUSH_INIT, IPC_PUSH_REGISTER, IPC_PUSH_SUBSCRIBE, IPC_PUSH_UNREGISTER } from "../../src/common/constants";
import * as push from "../push";
import { ipcHandle, IpcController } from "./ipc-controller";

/** Push notification registration for the signed-in WowUp account */
export class PushController implements IpcController {
  public register(): void {
    ipcHandle(IPC_PUSH_INIT, () => push.startPushService());
    ipcHandle(IPC_PUSH_REGISTER, (_evt, appId: string) => push.registerForPush(appId));
    ipcHandle(IPC_PUSH_UNREGISTER, () => push.unregisterPush());
    ipcHandle(IPC_PUSH_SUBSCRIBE, (_evt, channel: string) => push.subscribeToChannel(channel));
  }
}
