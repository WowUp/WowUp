import { PreferenceStorageService } from "../storage/preference-storage.service";
import { ElectronService } from "./electron.service";

class StubbedElectronService extends ElectronService {
  public get isElectron(): boolean {
    return false;
  }
}

describe("ElectronService", () => {
  let preferenceStorageSpy: PreferenceStorageService;

  beforeEach(async () => {
    preferenceStorageSpy = jasmine.createSpyObj("PreferenceStorageService", [""], {});
  });

  it("should be created", () => {
    const service: ElectronService = new StubbedElectronService(preferenceStorageSpy);
    expect(service).toBeTruthy();
  });
});
