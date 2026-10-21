import { getWowGameType, WowClientType } from "wowup-lib-core";
import type { WtfBackupMetadataFile } from "./wtf.service";

export type WtfBackupSource = "this_device" | "other_device" | "unknown";

/** Where a backup was made, as far as its optional metadata knows. */
export function getWtfBackupSource(
  meta: WtfBackupMetadataFile | undefined,
  deviceId: string | undefined,
): WtfBackupSource {
  if (!deviceId || typeof meta?.deviceId !== "string" || meta.deviceId.length === 0) {
    return "unknown";
  }

  return meta.deviceId === deviceId ? "this_device" : "other_device";
}

/** True only when both sides recorded a client type and those types belong to different games. */
export function isDifferentClientType(
  backupClientType: WowClientType | undefined,
  installationClientType: WowClientType,
): boolean {
  if (typeof backupClientType !== "number") {
    return false;
  }

  return getWowGameType(backupClientType) !== getWowGameType(installationClientType);
}

/** Whether the backup itself contains a Config.wtf that could overwrite this computer's display settings. */
export function hasConfigFile(meta: WtfBackupMetadataFile | undefined): boolean {
  if (!Array.isArray(meta?.contents)) {
    return false;
  }

  return meta.contents.some(
    (item) => !item.isDirectory && item.path.replace(/\\/g, "/").replace(/^\/+/, "") === "Config.wtf",
  );
}
