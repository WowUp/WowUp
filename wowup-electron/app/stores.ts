import { ipcMain, IpcMainInvokeEvent } from "electron";
import * as Store from "electron-store";
import {
  ADDON_STORE_NAME,
  IPC_STORE_GET_ALL,
  IPC_STORE_GET_OBJECT,
  IPC_STORE_GET_OBJECT_SYNC,
  IPC_STORE_REMOVE_OBJECT,
  IPC_STORE_SET_OBJECT,
  PREFERENCE_STORE_NAME,
  SENSITIVE_STORE_NAME,
} from "../src/common/constants";

const addonStore = new Store({ name: ADDON_STORE_NAME });
const preferenceStore = new Store({ name: PREFERENCE_STORE_NAME });
const sensitiveStore = new Store({ name: SENSITIVE_STORE_NAME });

const stores: { [storeName: string]: Store } = {
  [ADDON_STORE_NAME]: addonStore,
  [PREFERENCE_STORE_NAME]: preferenceStore,
  [SENSITIVE_STORE_NAME]: sensitiveStore,
};

export function getPreferenceStore(): Store {
  return preferenceStore;
}

export function getAddonStore(): Store {
  return addonStore;
}

export function initializeStoreIpcHandlers(): void {
  // Return the store value for a specific key
  ipcMain.handle(IPC_STORE_GET_ALL, (evt: IpcMainInvokeEvent, storeName: string): any[] => {
    const store = stores[storeName];

    const items: any[] = [];
    for (const result of store) {
      const item = result[1];
      items.push(item as any);
    }

    return items;
  });

  // Return the store value for a specific key
  ipcMain.handle(IPC_STORE_GET_OBJECT, (evt: IpcMainInvokeEvent, storeName: string, key: string): any => {
    const store = stores[storeName];
    return store ? store.get(key, undefined) : undefined;
  });

  ipcMain.on(IPC_STORE_GET_OBJECT_SYNC, (evt, storeName: string, key: string) => {
    const store = stores[storeName];
    evt.returnValue = store ? store.get(key, undefined) : undefined;
  });

  // Set the store value for a specific key
  ipcMain.handle(IPC_STORE_SET_OBJECT, (evt: IpcMainInvokeEvent, storeName: string, key: string, value: any): void => {
    const store = stores[storeName];

    let storedVal = value.toString();
    if (typeof value === "object" || Array.isArray(value)) {
      storedVal = value;
    }

    store?.set(key, storedVal);

    return storedVal;
  });

  // Remove the store value for a specific key
  ipcMain.handle(IPC_STORE_REMOVE_OBJECT, (evt: IpcMainInvokeEvent, storeName: string, key: string): void => {
    const store = stores[storeName];
    store?.delete(key);
  });
}
