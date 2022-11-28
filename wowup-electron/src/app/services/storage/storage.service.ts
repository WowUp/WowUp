import { Subject } from "rxjs";
import {
  IPC_STORE_GET_OBJECT,
  IPC_STORE_GET_OBJECT_SYNC,
  IPC_STORE_SET_OBJECT,
  TRUE_STR,
} from "../../../common/constants";
import { ElectronService } from "../electron/electron.service";

export interface StorageChangeEvent<T = any> {
  key: string;
  value: T;
}

export abstract class StorageService {
  protected readonly _changeSrc = new Subject<StorageChangeEvent>();
  protected abstract readonly storageName: string;

  public change$ = this._changeSrc.asObservable();

  protected constructor(private _electronService: ElectronService) {}

  public async getBool(key: string): Promise<boolean> {
    const val = await this.getAsync(key);
    return val === TRUE_STR;
  }

  public getAsync<T = string>(key: string): Promise<T> {
    return this._electronService.invoke(IPC_STORE_GET_OBJECT, this.storageName, key);
  }

  public getSync<T = string>(key: string): T {
    return this._electronService.sendSync<T>(IPC_STORE_GET_OBJECT_SYNC, this.storageName, key);
  }

  public async setAsync(key: string, value: unknown): Promise<void> {
    try {
      const result = await this._electronService.invoke(IPC_STORE_SET_OBJECT, this.storageName, key, value);
      this._changeSrc.next({ key, value: result });
      return result;
    } catch (e) {
      console.error(`setAsync failed: ${key}`);
      throw e;
    }
  }

  public getObjectAsync<T>(key: string): Promise<T | undefined> {
    return this._electronService.invoke(IPC_STORE_GET_OBJECT, this.storageName, key);
  }
}
