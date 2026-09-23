import { webContents } from "electron";

/**
 * Chromium's process metrics only say "Tab", which is useless once an app has several renderers:
 * the main window, the ad view, the consent window and every open devtools window all report the
 * same type. Map each process back to what is actually running in it.
 *
 * One process can host more than one WebContents, so labels are joined rather than overwritten.
 */
export function getWebContentsLabels(): Map<number, string> {
  const byPid = new Map<number, string[]>();

  for (const contents of webContents.getAllWebContents()) {
    if (contents.isDestroyed()) {
      continue;
    }

    let pid: number;
    try {
      pid = contents.getOSProcessId();
    } catch {
      // A WebContents can be torn down between listing it and asking about it.
      continue;
    }

    if (pid <= 0) {
      continue;
    }

    const existing = byPid.get(pid) ?? [];
    const label = describeContents(contents);
    if (!existing.includes(label)) {
      existing.push(label);
    }
    byPid.set(pid, existing);
  }

  const labels = new Map<number, string>();
  for (const [pid, parts] of byPid) {
    labels.set(pid, parts.join("+"));
  }
  return labels;
}

function describeContents(contents: Electron.WebContents): string {
  let url = "";
  try {
    url = contents.getURL();
  } catch {
    url = "";
  }

  // Devtools is itself a renderer, and an app with a few panels open can easily be running more
  // devtools processes than app ones.
  if (url.startsWith("devtools://")) {
    return "devtools";
  }

  return `${contents.getType()}:${shortenUrl(url)}`;
}

function shortenUrl(url: string): string {
  if (url.length === 0) {
    return "blank";
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === "file:") {
      const name = parsed.pathname.split("/").filter(Boolean).pop();
      return name ?? "file";
    }
    return parsed.host;
  } catch {
    return "unknown";
  }
}
