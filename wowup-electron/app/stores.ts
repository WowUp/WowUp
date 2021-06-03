import { ipcMain, IpcMainInvokeEvent } from "electron";
import * as Store from "electron-store";
import {
  ADDON_STORE_NAME,
  IPC_STORE_GET_OBJECT,
  IPC_STORE_SET_OBJECT,
  PREFERENCE_STORE_NAME,
} from "../src/common/constants";

// https://github.com/sindresorhus/electron-store#initrenderer
Store.initRenderer();

export const addonStore = new Store({ name: ADDON_STORE_NAME });
export const preferenceStore = new Store({ name: PREFERENCE_STORE_NAME });

const stores: { [storeName: string]: Store } = {
  [ADDON_STORE_NAME]: addonStore,
  [PREFERENCE_STORE_NAME]: preferenceStore,
};

export function initializeStoreIpcHandlers(): void {
  // Return the store value for a specific key
  ipcMain.handle(IPC_STORE_GET_OBJECT, (evt: IpcMainInvokeEvent, storeName: string, key: string): any => {
    const store = stores[storeName];
    return store ? store.get(key, undefined) : undefined;
  });

  // Set the store value for a specific key
  ipcMain.handle(IPC_STORE_SET_OBJECT, (evt: IpcMainInvokeEvent, storeName: string, key: string, value: any): void => {
    const store = stores[storeName];
    store?.set(key, value);
  });
}
