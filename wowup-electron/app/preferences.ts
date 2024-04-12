import { app } from "electron";

import {
  ACCT_PUSH_ENABLED_KEY,
  COLLAPSE_TO_TRAY_PREFERENCE_KEY,
  CURRENT_THEME_KEY,
  DEFAULT_THEME,
  DEFAULT_TRUSTED_DOMAINS,
  ENABLE_APP_BADGE_KEY,
  ENABLE_SYSTEM_NOTIFICATIONS_PREFERENCE_KEY,
  TRUSTED_DOMAINS_KEY,
  USE_HARDWARE_ACCELERATION_PREFERENCE_KEY,
  USE_SYMLINK_MODE_PREFERENCE_KEY,
  WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY,
} from "../src/common/constants";
import { WowUpReleaseChannelType } from "../src/common/wowup/wowup-release-channel-type";
import { getPreferenceStore } from "./stores";
import * as log from "electron-log/main";

export function initializeDefaultPreferences() {
  const isBetaBuild = app.getVersion().toLowerCase().indexOf("beta") != -1;
  const defaultReleaseChannel = isBetaBuild ? WowUpReleaseChannelType.Beta : WowUpReleaseChannelType.Stable;

  setDefaultPreference(ENABLE_SYSTEM_NOTIFICATIONS_PREFERENCE_KEY, true);
  setDefaultPreference(COLLAPSE_TO_TRAY_PREFERENCE_KEY, true);
  setDefaultPreference(USE_HARDWARE_ACCELERATION_PREFERENCE_KEY, true);
  setDefaultPreference(CURRENT_THEME_KEY, DEFAULT_THEME);
  setDefaultPreference(WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY, defaultReleaseChannel);
  setDefaultPreference(USE_SYMLINK_MODE_PREFERENCE_KEY, false);
  setDefaultPreference(ENABLE_APP_BADGE_KEY, true);
  setDefaultPreference(TRUSTED_DOMAINS_KEY, DEFAULT_TRUSTED_DOMAINS);
  setDefaultPreference(ACCT_PUSH_ENABLED_KEY, false);
}

export function getWowUpReleaseChannelPreference(): WowUpReleaseChannelType {
  const val = getPreferenceStore().get(WOWUP_RELEASE_CHANNEL_PREFERENCE_KEY) as string;
  return parseInt(val, 10) as WowUpReleaseChannelType;
}

function setDefaultPreference(key: string, defaultValue: any) {
  const prefStore = getPreferenceStore();
  const pref = prefStore.get(key);
  if (pref === null || pref === undefined) {
    const valStr: string = defaultValue.toString();
    log.info(`Setting default preference: ${key} -> ${valStr}`);
    if (Array.isArray(defaultValue)) {
      prefStore.set(key, defaultValue);
    } else {
      prefStore.set(key, defaultValue.toString());
    }
  }
}
