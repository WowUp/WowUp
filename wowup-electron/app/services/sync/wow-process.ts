import { execFile } from "child_process";

/** Process names of every WoW client: "World of Warcraft" on macOS, Wow*.exe on Windows and under Wine */
const WOW_PROCESS = /(^|[\\/])(world of warcraft[^\\/]*|wow(?!up)[a-z0-9-]*\.exe)$/i;

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (error, stdout) =>
      error ? reject(error) : resolve(stdout),
    );
  });
}

export function isWowProcessName(name: string): boolean {
  return WOW_PROCESS.test(name.trim());
}

/** Whether any World of Warcraft client is running; the game rewrites WTF when it exits */
export async function isWowRunning(platform: NodeJS.Platform = process.platform): Promise<boolean> {
  const output =
    platform === "win32" ? await run("tasklist", ["/fo", "csv", "/nh"]) : await run("ps", ["-axo", "comm="]);

  return output
    .split(/\r?\n/)
    .map((line) => (platform === "win32" ? line.split('","')[0].replace(/^"/, "") : line))
    .some(isWowProcessName);
}
