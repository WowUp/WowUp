/* eslint-disable @typescript-eslint/unbound-method */
import { firstValueFrom } from "rxjs";

import { MatDialog } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";

import { AnalyticsService } from "../analytics/analytics.service";
import { ElectronService } from "../electron/electron.service";
import { WowUpService } from "../wowup/wowup.service";
import { LinkService } from "./link.service";

describe("LinkService", () => {
  let service: LinkService;
  let dialog: jasmine.SpyObj<MatDialog>;
  let electronService: jasmine.SpyObj<ElectronService>;
  let wowUpService: jasmine.SpyObj<WowUpService>;

  beforeEach(() => {
    dialog = jasmine.createSpyObj<MatDialog>("MatDialog", ["open"]);
    electronService = jasmine.createSpyObj<ElectronService>("ElectronService", ["openExternal"]);
    electronService.openExternal.and.returnValue(Promise.resolve());
    wowUpService = jasmine.createSpyObj<WowUpService>("WowUpService", ["getTrustedDomains", "isTrustedDomain"]);
    wowUpService.getTrustedDomains.and.returnValue(Promise.resolve<string[]>([]));
    wowUpService.isTrustedDomain.and.returnValue(Promise.resolve(true));
    const analyticsService = jasmine.createSpyObj<AnalyticsService>("AnalyticsService", ["trackAction"]);

    service = new LinkService(dialog, analyticsService, electronService, wowUpService, {} as TranslateService);
  });

  describe("confirmLinkNavigation", () => {
    // A CurseForge-relative link resolved against the renderer's file:// origin (issue #1631)
    ["file:///linkout?remoteUrl=https%253a%252f%252fexample.com", "javascript:alert(1)", "not a url"].forEach(
      (href) => {
        it(`should ignore non-web link "${href}"`, async () => {
          await firstValueFrom(service.confirmLinkNavigation(href));

          expect(electronService.openExternal).not.toHaveBeenCalled();
          expect(dialog.open).not.toHaveBeenCalled();
          expect(wowUpService.isTrustedDomain).not.toHaveBeenCalled();
        });
      },
    );

    it("should open a trusted https link", async () => {
      await firstValueFrom(service.confirmLinkNavigation("https://ellesmereui.com/patch-notes"));

      expect(electronService.openExternal).toHaveBeenCalledWith("https://ellesmereui.com/patch-notes");
    });
  });
});
