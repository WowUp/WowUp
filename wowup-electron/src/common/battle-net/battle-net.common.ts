import { BrowserWindow, ipcMain, session } from "electron";
import { join } from "path";

export type BattleNetRegion = "US" | "EU" | "CN" | "KR" | "TW";

export const IPC_BATTLE_NET_LOGIN = "battle_net_login";

export const BATTLE_NET_SIGN_IN_REDIRECT_URL = "https://signin.wowup.io/callback";

let activeSignInWindow: BrowserWindow;

export function initializeBattleNetIpcHandlers(window: BrowserWindow): void {
  console.debug("INIT BNET HANDLERS");

  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (details.url.startsWith(BATTLE_NET_SIGN_IN_REDIRECT_URL)) {
      console.debug("BATTLE_NET_SIGN_IN_REDIRECT_URL Caught", details);
      activeSignInWindow?.close();
      return callback({ cancel: true });
    }

    callback({});
  });

  ipcMain.handle(IPC_BATTLE_NET_LOGIN, async (evt, signInUrl) => {
    console.debug("BNET LOGIN", signInUrl);
    if (activeSignInWindow !== undefined) {
      throw new Error("SignIn already active");
    }

    activeSignInWindow = await launchBattleNetSignInWindow(signInUrl);
    activeSignInWindow.on("closed", () => {
      activeSignInWindow = undefined;
    });

    return true;
  });
}

async function launchBattleNetSignInWindow(url: string): Promise<BrowserWindow> {
  const faviconPath = join(__dirname, "..", "assets", "icon.ico");
  const signInWin = new BrowserWindow({ width: 800, height: 800, resizable: false, autoHideMenuBar: true });
  const pageHtml = `
    <!DOCTYPE html>
      <html>
      <head>
        <link rel="icon" type="image/x-icon" href="file://${faviconPath}" />
        <title>WowUp.io</title>
        <meta charset="UTF-8">
        <meta http-equiv="refresh" content="0; URL=${url}" />
      </head>
      <body>
      </body>
    </html>`;

  const file = "data:text/html;charset=UTF-8," + encodeURIComponent(pageHtml);

  await signInWin.loadURL(file);
  return signInWin;
}
