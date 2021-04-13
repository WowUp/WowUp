import * as Store from "electron-store";

// https://github.com/sindresorhus/electron-store#initrenderer
Store.initRenderer();

export const addonStore = new Store({ name: "addons" });
export const preferenceStore = new Store({ name: "preferences" });
