import { HttpClient } from "@angular/common/http";

import { SensitiveStorageService } from "../services/storage/sensitive-storage.service";
import { GitHubAddonProvider } from "./github-addon-provider";

describe("GitHubAddonProvider", () => {
  let sensitiveStorageService: jasmine.SpyObj<SensitiveStorageService>;
  let provider: GitHubAddonProvider;

  beforeEach(() => {
    sensitiveStorageService = jasmine.createSpyObj<SensitiveStorageService>("SensitiveStorageService", ["getAsync"]);
    provider = new GitHubAddonProvider({} as HttpClient, sensitiveStorageService);
  });

  describe("getDownloadAuth", () => {
    // Regression test for #1520. The asset endpoint returns 200 with a JSON metadata body
    // unless this header is present, and that body gets written to disk as the addon zip.
    it("should send the octet-stream accept header with no personal access token", async () => {
      sensitiveStorageService.getAsync.and.resolveTo("");

      const auth = await provider.getDownloadAuth();

      expect(auth?.headers?.Accept).toEqual("application/octet-stream");
      expect(auth?.headers?.Authorization).toBeUndefined();
    });

    it("should send the octet-stream accept header with a personal access token", async () => {
      sensitiveStorageService.getAsync.and.resolveTo("test-token");

      const auth = await provider.getDownloadAuth();

      expect(auth?.headers?.Accept).toEqual("application/octet-stream");
      expect(auth?.headers?.Authorization).toEqual("Bearer test-token");
    });
  });
});
