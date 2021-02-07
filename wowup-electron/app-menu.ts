import * as platform from "./platform";
import { app, BrowserWindow, Menu, MenuItem, MenuItemConstructorOptions } from "electron";
import { IPC_MENU_ZOOM_IN_CHANNEL, IPC_MENU_ZOOM_OUT_CHANNEL, IPC_MENU_ZOOM_RESET_CHANNEL } from "./src/common/constants";
import { MenuConfig } from "./src/common/wowup/menu-config";

function onMenuZoomIn(win: BrowserWindow) {
  win?.webContents.send(IPC_MENU_ZOOM_IN_CHANNEL);
}

function onMenuZoomOut(win: BrowserWindow) {
  win?.webContents.send(IPC_MENU_ZOOM_OUT_CHANNEL);
}

function onMenuZoomReset(win: BrowserWindow) {
  win?.webContents.send(IPC_MENU_ZOOM_RESET_CHANNEL);
}

function createMacMenuItems(win: BrowserWindow, config?: MenuConfig): Array<MenuItemConstructorOptions | MenuItem> {
  const viewMenu: MenuItemConstructorOptions = {
    label: config.viewLabel,
    submenu: [
      { label: config.reloadLabel, role: "reload" },
      { label: config.forceReloadLabel, role: "forceReload" },
      { label: config.toggleDevToolsLabel, role: "toggleDevTools", accelerator: "CommandOrControl+Shift+I" },
      { type: "separator" },
    ],
  };

  const viewMenuArr = viewMenu.submenu as MenuItemConstructorOptions[];
  if (config) {
    viewMenuArr.push(
      {
        label: config.zoomInLabel,
        click: () => onMenuZoomIn(win),
        accelerator: "CommandOrControl+=",
      },
      {
        label: config.zoomOutLabel,
        click: () => onMenuZoomOut(win),
        accelerator: "CommandOrControl+-",
      },
      {
        label: config.zoomResetLabel,
        click: () => onMenuZoomReset(win),
        accelerator: "CommandOrControl+0",
      }
    );
  }

  viewMenuArr.push({ type: "separator" }, { label: config.toggleFullScreenLabel, role: "togglefullscreen" });

  console.debug(config);

  return [
    {
      label: app.name,
      submenu: [{ label: config.quitLabel, role: "quit" }],
    },
    {
      label: config.editLabel,
      submenu: [
        { label: config.undoLabel, role: "undo" },
        { label: config.redoLabel, role: "redo" },
        { type: "separator" },
        { label: config.cutLabel, role: "cut" },
        { label: config.copyLabel, role: "copy" },
        { label: config.pasteLabel, role: "paste" },
        { label: config.selectAllLabel, role: "selectAll" },
      ],
    },
    viewMenu,
    {
      label: config.windowLabel,
      submenu: [
        {
          label: config.windowCloseLabel,
          role: "close" /*click: () => win?.close(), accelerator: "CommandOrControl+w"*/,
        },
      ],
    },
  ];
}

function createLinuxMenuItems(win: BrowserWindow, config?: MenuConfig): Array<MenuItemConstructorOptions | MenuItem> {
  return [
    {
      label: app.name,
      submenu: [{ label: config.quitLabel, role: "quit" }],
    },
    {
      label: "Edit",
      submenu: [
        { label: config.undoLabel, role: "undo" },
        { label: config.redoLabel, role: "redo" },
        { type: "separator" },
        { label: config.cutLabel, role: "cut" },
        { label: config.copyLabel, role: "copy" },
        { label: config.pasteLabel, role: "paste" },
        { label: config.selectAllLabel, role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: config.reloadLabel, role: "reload" },
        { label: config.forceReloadLabel, role: "forceReload" },
        { label: config.toggleDevToolsLabel, role: "toggleDevTools" },
        { type: "separator" },
        // { role: "resetZoom" },
        // { role: "zoomIn", accelerator: "CommandOrControl+=" },
        // { role: "zoomOut" },
        // { type: "separator" },
        { label: config.toggleFullScreenLabel, role: "togglefullscreen" },
      ],
    },
  ];
}

function createWindowsMenuItems(win: BrowserWindow, config?: MenuConfig): Array<MenuItemConstructorOptions | MenuItem> {
  const viewMenu: MenuItemConstructorOptions = {
    label: config.viewLabel,
    submenu: [{ label: config.toggleDevToolsLabel, role: "toggleDevTools", accelerator: "CommandOrControl+Shift+I" }],
  };

  const viewMenuArr = viewMenu.submenu as MenuItemConstructorOptions[];
  if (config) {
    viewMenuArr.push(
      {
        label: config.zoomInLabel,
        click: () => onMenuZoomIn(win),
        accelerator: "CommandOrControl+=",
      },
      {
        label: config.zoomOutLabel,
        click: () => onMenuZoomOut(win),
        accelerator: "CommandOrControl+-",
      },
      {
        label: config.zoomResetLabel,
        click: () => onMenuZoomReset(win),
        accelerator: "CommandOrControl+0",
      }
    );
  }

  viewMenuArr.push({ type: "separator" }, { label: config.toggleFullScreenLabel, role: "togglefullscreen" });

  return [viewMenu];
}

function createMenuItems(win: BrowserWindow, config?: MenuConfig): Array<MenuItemConstructorOptions | MenuItem> {
  console.debug("CREATING MENU");
  if (!config) {
    return [];
  }

  if (platform.isWin) {
    return createWindowsMenuItems(win, config);
  } else if (platform.isMac) {
    return createMacMenuItems(win, config);
  } else if (platform.isLinux) {
    return createLinuxMenuItems(win, config);
  }

  return [];
}

export function createAppMenu(win: BrowserWindow, config?: MenuConfig) {
  const menuItems = createMenuItems(win, config);

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuItems));

  return true;
}
