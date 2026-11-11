import { WowClientType } from "wowup-lib-core";
import { getWtfBackupSource, hasConfigFile, isDifferentClientType } from "./wtf-backup-source";
import type { WtfBackupMetadataFile } from "./wtf.service";

function metadata(overrides: Partial<WtfBackupMetadataFile> = {}): WtfBackupMetadataFile {
  return {
    createdBy: "manual",
    createdAt: 0,
    contents: [],
    ...overrides,
  };
}

describe("wtf backup source", () => {
  it("treats a backup without a device id as unknown", () => {
    expect(getWtfBackupSource(metadata(), "device-a")).toBe("unknown");
  });

  it("treats a backup without a local device id as unknown", () => {
    expect(getWtfBackupSource(metadata({ deviceId: "device-a" }), undefined)).toBe("unknown");
  });

  it("recognises a backup from this device", () => {
    expect(getWtfBackupSource(metadata({ deviceId: "device-a" }), "device-a")).toBe("this_device");
  });

  it("recognises a backup from another device", () => {
    expect(getWtfBackupSource(metadata({ deviceId: "device-b" }), "device-a")).toBe("other_device");
  });

  it("treats pointer clients as the same game", () => {
    expect(isDifferentClientType(WowClientType.RetailPtr, WowClientType.Retail)).toBe(false);
  });

  it("detects a different game", () => {
    expect(isDifferentClientType(WowClientType.Retail, WowClientType.ClassicEra)).toBe(true);
  });

  it("treats a missing client type as the same game", () => {
    expect(isDifferentClientType(undefined, WowClientType.Retail)).toBe(false);
  });

  it("detects Config.wtf in the backup contents", () => {
    expect(hasConfigFile(metadata({ contents: [{ path: "/Config.wtf", isDirectory: false, size: 1 }] }))).toBe(true);
    expect(hasConfigFile(metadata({ contents: [{ path: "\\Config.wtf", isDirectory: false, size: 1 }] }))).toBe(true);
    expect(hasConfigFile(metadata({ contents: [{ path: "/Account/Test.lua", isDirectory: false, size: 1 }] }))).toBe(
      false,
    );
  });

  it("treats a backup without metadata as having no Config.wtf", () => {
    expect(hasConfigFile(undefined)).toBe(false);
  });
});
