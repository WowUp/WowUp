import { inject } from "@angular/core/testing";
import { ElectronService } from "../../services/electron/electron.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { OptionsComponent } from "./options.component";

describe("OptionsComponent", () => {
  it("should create", () => {
    inject(
      [
        WowUpService,
        ElectronService,
      ],
      (
        wowupService: WowUpService,
        electronService: ElectronService,
      ) => {
        const instance = new OptionsComponent(
          wowupService,
          electronService,
        );
        expect(instance).toBeTruthy();
      }
    );
  });
});
