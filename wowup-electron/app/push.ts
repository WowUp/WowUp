import * as log from "electron-log/main";
import { EventEmitter } from "events";

export const PUSH_NOTIFICATION_EVENT = "push-notification";
export const pushEvents = new EventEmitter();

const channelSubscriptions = new Map<string, boolean>();

let Pushy: any;
export function startPushService(): boolean {
  if (!Pushy) {
    Pushy = require("pushy-electron");
  }

  // Listen for push notifications
  Pushy.setNotificationListener((data) => {
    pushEvents.emit(PUSH_NOTIFICATION_EVENT, data);
  });

  Pushy.listen();
  return true;
}

export async function registerForPush(appId: string): Promise<string> {
  if (!Pushy) {
    throw new Error("Push not started");
  }
  if (!appId) {
    throw new Error("Invalid push app id");
  }

  return await Pushy.register({ appId });
}

export async function unregisterPush(): Promise<void> {
  for (const [key] of channelSubscriptions) {
    try {
      await Pushy.unsubscribe(key);
    } catch (e) {
      console.error(e);
    }
  }

  channelSubscriptions.clear();

  Pushy.disconnect();
}

export async function subscribeToChannel(channel: string): Promise<void> {
  // Make sure the user is registered
  if (!Pushy.isRegistered()) {
    throw new Error("Push services not registered");
  }

  if (channelSubscriptions.has(channel)) {
    log.warn(`Already listening: ${channel}`);
    return;
  }

  // Subscribe the user to a topic
  await Pushy.subscribe(channel);
  channelSubscriptions.set(channel, true);
  log.debug(`Subscribed: ${channel}`);
}
