import { expect } from "chai";

import { darwinToMacOsVersion, isUpdateUnsupportedOnOs } from "./update-os-support";

describe("update-os-support", () => {
  describe("isUpdateUnsupportedOnOs", () => {
    it("is false when the release doesn't name a minimum OS", () => {
      expect(isUpdateUnsupportedOnOs(undefined, "20.6.0")).to.equal(false);
      expect(isUpdateUnsupportedOnOs("", "20.6.0")).to.equal(false);
    });

    it("is true when the OS is older than the minimum", () => {
      // macOS 11.7 (Darwin 20.6) against a release that needs macOS 12 (Darwin 21)
      expect(isUpdateUnsupportedOnOs("21.0.0", "20.6.0")).to.equal(true);
      expect(isUpdateUnsupportedOnOs("21.2.0", "21.1.9")).to.equal(true);
    });

    it("is false when the OS is the minimum or newer", () => {
      expect(isUpdateUnsupportedOnOs("21.0.0", "21.0.0")).to.equal(false);
      expect(isUpdateUnsupportedOnOs("21.0.0", "21.6.0")).to.equal(false);
      expect(isUpdateUnsupportedOnOs("21.0.0", "25.1.0")).to.equal(false);
    });

    it("compares numerically, not as text", () => {
      expect(isUpdateUnsupportedOnOs("21.0.0", "9.8.0")).to.equal(true);
      expect(isUpdateUnsupportedOnOs("9.0.0", "21.0.0")).to.equal(false);
    });

    it("is false when either version can't be parsed", () => {
      expect(isUpdateUnsupportedOnOs("not-a-version", "20.6.0")).to.equal(false);
      expect(isUpdateUnsupportedOnOs("21.0.0", "unknown")).to.equal(false);
    });
  });

  describe("darwinToMacOsVersion", () => {
    it("names the macOS for known Darwin versions", () => {
      expect(darwinToMacOsVersion("20.6.0")).to.equal("11");
      expect(darwinToMacOsVersion("21.0.0")).to.equal("12");
      expect(darwinToMacOsVersion("24.0.0")).to.equal("15");
      expect(darwinToMacOsVersion("25.0.0")).to.equal("26");
    });

    it("is undefined for unknown or unparsable versions", () => {
      expect(darwinToMacOsVersion("99.0.0")).to.equal(undefined);
      expect(darwinToMacOsVersion("")).to.equal(undefined);
    });
  });
});
