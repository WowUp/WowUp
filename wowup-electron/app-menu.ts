import * as platform from "./platform";
import { app, BrowserWindow, Menu, MenuItem, MenuItemConstructorOptions } from "electron";
import { MENU_ZOOM_IN_CHANNEL, MENU_ZOOM_OUT_CHANNEL, MENU_ZOOM_RESET_CHANNEL } from "./src/common/constants";
import { MenuConfig } from "./src/common/wowup/menu-config";

function onMenuZoomIn(win: BrowserWindow) {
  win?.webContents.send(MENU_ZOOM_IN_CHANNEL);
}

function onMenuZoomOut(win: BrowserWindow) {
  win?.webContents.send(MENU_ZOOM_OUT_CHANNEL);
}

function onMenuZoomReset(win: BrowserWindow) {
  win?.webContents.send(MENU_ZOOM_RESET_CHANNEL);
}

function createMacMenuItems(win: BrowserWindow, config?: MenuConfig): Array<MenuItemConstructorOptions | MenuItem> {
  const viewMenu: MenuItemConstructorOptions = {
    label: config.viewLabel,
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools", accelerator: "CommandOrControl+Shift+I" },
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

  viewMenuArr.push({ type: "separator" }, { role: "togglefullscreen" });

  return [
    {
      label: app.name,
      submenu: [{ role: "quit" }],
    },
    // {
    //   label: config.editLabel,
    //   submenu: [
    //     { role: "undo" },
    //     { role: "redo" },
    //     { type: "separator" },
    //     { role: "cut" },
    //     { role: "copy" },
    //     { role: "paste" },
    //     { role: "selectAll" },
    //   ],
    // },
    viewMenu,
  ];
}

function createLinuxMenuItems(win: BrowserWindow, config?: MenuConfig): Array<MenuItemConstructorOptions | MenuItem> {
  return [
    {
      label: app.name,
      submenu: [{ role: "quit" }],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        // { role: "resetZoom" },
        // { role: "zoomIn", accelerator: "CommandOrControl+=" },
        // { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
  ];
}

function createWindowsMenuItems(win: BrowserWindow, config?: MenuConfig): Array<MenuItemConstructorOptions | MenuItem> {
  const viewMenu: MenuItemConstructorOptions = {
    label: config.viewLabel,
    submenu: [{ role: "toggleDevTools", accelerator: "CommandOrControl+Shift+I" }],
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

  viewMenuArr.push({ type: "separator" }, { role: "togglefullscreen" });

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
