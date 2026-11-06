import { expect } from "chai";
import * as Store from "electron-store";

import { Addon } from "wowup-lib-core";

import { AddonController } from "./addon.controller";

function createAddon(id: string, installationId: string): Addon {
  return { id, name: id, installationId } as Addon;
}

/** Just enough of electron-store for the controller: iterable, keyed by addon id */
function createStore(addons: Addon[]): Map<string, unknown> {
  return new Map<string, unknown>(addons.map((a) => [a.id, a]));
}

describe("AddonController", () => {
  describe("replaceAllForInstallation", () => {
    it("swaps the installation's addons for the new ones", () => {
      const store = createStore([createAddon("old-1", "retail"), createAddon("old-2", "retail")]);

      new AddonController(store as unknown as Store).replaceAllForInstallation("retail", [
        createAddon("new-1", "retail"),
      ]);

      expect([...store.keys()]).to.deep.equal(["new-1"]);
    });

    it("leaves other installations' addons alone", () => {
      const store = createStore([createAddon("old", "retail"), createAddon("classic-1", "classic")]);

      new AddonController(store as unknown as Store).replaceAllForInstallation("retail", []);

      expect([...store.keys()]).to.deep.equal(["classic-1"]);
    });

    it("never leaves two sets behind when called twice in a row", () => {
      const store = createStore([]);
      const controller = new AddonController(store as unknown as Store);

      controller.replaceAllForInstallation("retail", [createAddon("a-1", "retail"), createAddon("b-1", "retail")]);
      controller.replaceAllForInstallation("retail", [createAddon("a-2", "retail"), createAddon("b-2", "retail")]);

      expect([...store.keys()]).to.deep.equal(["a-2", "b-2"]);
    });

    it("skips addons without an id", () => {
      const store = createStore([createAddon("old", "retail")]);

      new AddonController(store as unknown as Store).replaceAllForInstallation("retail", [
        { name: "no id", installationId: "retail" } as Addon,
        createAddon("new", "retail"),
      ]);

      expect([...store.keys()]).to.deep.equal(["new"]);
    });

    it("does nothing when given bad input", () => {
      const store = createStore([createAddon("old", "retail")]);
      const controller = new AddonController(store as unknown as Store);

      controller.replaceAllForInstallation(undefined as unknown as string, []);
      controller.replaceAllForInstallation("retail", undefined as unknown as Addon[]);

      expect([...store.keys()]).to.deep.equal(["old"]);
    });
  });
});
