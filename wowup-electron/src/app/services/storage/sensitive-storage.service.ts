import { Injectable } from "@angular/core";

import { SENSITIVE_STORE_NAME } from "../../../common/constants";
import { StorageService } from "./storage.service";
import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class SensitiveStorageService extends StorageService {
  protected readonly storageName = SENSITIVE_STORE_NAME;

  public constructor(electronService: ElectronService) {
    super(electronService);
  }
}
