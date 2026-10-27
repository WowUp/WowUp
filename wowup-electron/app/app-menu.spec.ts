import { expect } from "chai";

import type { BrowserWindow, MenuItemConstructorOptions } from "electron";

import { createMacMenuItems } from "./app-menu";
import { MenuConfig } from "../src/common/wowup/models";

const CONFIG: MenuConfig = {
  editLabel: "edit",
  viewLabel: "view",
  zoomOutLabel: "zoom out",
  zoomInLabel: "zoom in",
  zoomResetLabel: "zoom reset",
  reloadLabel: "reload",
  forceReloadLabel: "force reload",
  toggleDevToolsLabel: "toggle dev tools",
  toggleFullScreenLabel: "toggle full screen",
  quitLabel: "quit",
  hideLabel: "hide",
  hideOthersLabel: "hide others",
  showAllLabel: "show all",
  undoLabel: "undo",
  redoLabel: "redo",
  cutLabel: "cut",
  copyLabel: "copy",
  pasteLabel: "paste",
  selectAllLabel: "select all",
  windowLabel: "window",
  windowCloseLabel: "close",
  windowMinimizeLabel: "minimize",
  windowZoomLabel: "zoom",
  windowBringAllToFrontLabel: "bring all to front",
};

function submenuOf(items: MenuItemConstructorOptions[], label: string): MenuItemConstructorOptions[] {
  const menu = items.find((item) => item.label === label);
  expect(menu, `menu ${label}`).to.not.equal(undefined);
  return menu?.submenu as MenuItemConstructorOptions[];
}

function rolesWithLabels(submenu: MenuItemConstructorOptions[]): Array<[string | undefined, string | undefined]> {
  return submenu.filter((item) => item.type !== "separator").map((item) => [item.role, item.label]);
}

describe("createMacMenuItems", () => {
  const win = {} as BrowserWindow;

  it("returns no items without a config", () => {
    expect(createMacMenuItems(win, undefined, "WowUp")).to.deep.equal([]);
  });

  it("includes the standard app menu roles so Cmd+H and Cmd+Alt+H work", () => {
    const items = createMacMenuItems(win, CONFIG, "WowUp") as MenuItemConstructorOptions[];

    expect(items[0].label).to.equal("WowUp");
    expect(rolesWithLabels(submenuOf(items, "WowUp"))).to.deep.equal([
      ["hide", "hide"],
      ["hideOthers", "hide others"],
      ["unhide", "show all"],
      ["quit", "quit"],
    ]);
  });

  it("includes the standard window menu roles so Cmd+M works", () => {
    const items = createMacMenuItems(win, CONFIG, "WowUp") as MenuItemConstructorOptions[];

    expect(rolesWithLabels(submenuOf(items, "window"))).to.deep.equal([
      ["minimize", "minimize"],
      ["zoom", "zoom"],
      ["close", "close"],
      ["front", "bring all to front"],
    ]);
  });

  it("keeps the edit menu roles", () => {
    const items = createMacMenuItems(win, CONFIG, "WowUp") as MenuItemConstructorOptions[];

    expect(submenuOf(items, "edit").map((item) => item.role)).to.include.members([
      "undo",
      "redo",
      "cut",
      "copy",
      "paste",
      "selectAll",
    ]);
  });
});
