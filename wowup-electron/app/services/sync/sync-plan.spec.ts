import { expect } from "chai";

import { applyPlanToRemote, baseFromRemote, isSyncedPath, LocalFiles, planSync, RemoteFiles } from "./sync-plan";

const SV = "Account/ACC/SavedVariables/WeakAuras.lua";
const MACROS = "Account/ACC/macros-cache.txt";

function file(hash: string, mtime = 1000) {
  return { hash, mtime, size: 1 };
}

describe("sync-plan", () => {
  describe("isSyncedPath", () => {
    it("carries account and character settings", () => {
      expect(isSyncedPath(SV)).to.equal(true);
      expect(isSyncedPath(MACROS)).to.equal(true);
      expect(isSyncedPath("Account/ACC/bindings-cache.wtf")).to.equal(true);
      expect(isSyncedPath("Account/ACC/Realm/Char/SavedVariables/Details.lua")).to.equal(true);
      expect(isSyncedPath("Account/ACC/Realm/Char/layout-local.txt")).to.equal(true);
      expect(isSyncedPath("SavedVariables/Blizzard_AddOnList.lua")).to.equal(true);
    });

    it("leaves out per-machine and throwaway files", () => {
      expect(isSyncedPath("Config.wtf")).to.equal(false);
      expect(isSyncedPath("GamePadConfig_Default.json")).to.equal(false);
      expect(isSyncedPath("gamecontrollerdb.txt")).to.equal(false);
      expect(isSyncedPath("Account/ACC/cache.md5")).to.equal(false);
      expect(isSyncedPath("Account/ACC/macros-cache.old")).to.equal(false);
      expect(isSyncedPath(`${SV}.bak`)).to.equal(false);
      expect(isSyncedPath("Account/ACC/.DS_Store")).to.equal(false);
      expect(isSyncedPath("wowup-meta.json")).to.equal(false);
      expect(isSyncedPath("Account/stray.txt")).to.equal(false);
      expect(isSyncedPath("Logs/x.txt")).to.equal(false);
    });
  });

  describe("planSync", () => {
    const opts = { joining: false, now: 5000 };

    it("does nothing when both sides agree", () => {
      const plan = planSync({ [SV]: file("a") }, { [SV]: file("a") }, { [SV]: "a" }, opts);
      expect(plan).to.deep.equal({ download: [], upload: [], deleteLocal: [], deleteRemote: [], conflicts: [] });
    });

    it("takes the side that changed", () => {
      expect(planSync({ [SV]: file("b") }, { [SV]: file("a") }, { [SV]: "a" }, opts).upload).to.deep.equal([SV]);
      expect(planSync({ [SV]: file("a") }, { [SV]: file("b") }, { [SV]: "a" }, opts).download).to.deep.equal([SV]);
    });

    it("adds new files from either side", () => {
      const plan = planSync({ [SV]: file("a") }, { [MACROS]: file("m") }, {}, opts);
      expect(plan.upload).to.deep.equal([SV]);
      expect(plan.download).to.deep.equal([MACROS]);
    });

    it("carries deletions both ways", () => {
      expect(planSync({}, { [SV]: file("a") }, { [SV]: "a" }, opts).deleteRemote).to.deep.equal([SV]);
      expect(
        planSync({ [SV]: file("a") }, { [SV]: { deleted: true, mtime: 10 } }, { [SV]: "a" }, opts).deleteLocal,
      ).to.deep.equal([SV]);
    });

    it("lets the newest win when both changed", () => {
      const localNewer = planSync({ [SV]: file("b", 3000) }, { [SV]: file("c", 2000) }, { [SV]: "a" }, opts);
      expect(localNewer.upload).to.deep.equal([SV]);
      expect(localNewer.conflicts).to.deep.equal([SV]);

      const remoteNewer = planSync({ [SV]: file("b", 2000) }, { [SV]: file("c", 3000) }, { [SV]: "a" }, opts);
      expect(remoteNewer.download).to.deep.equal([SV]);
      expect(remoteNewer.conflicts).to.deep.equal([SV]);
    });

    it("keeps an edit over an older deletion, and a newer deletion over an edit", () => {
      const editWins = planSync(
        { [SV]: file("b", 3000) },
        { [SV]: { deleted: true, mtime: 2000 } },
        { [SV]: "a" },
        opts,
      );
      expect(editWins.upload).to.deep.equal([SV]);

      const deleteWins = planSync(
        { [SV]: file("b", 2000) },
        { [SV]: { deleted: true, mtime: 3000 } },
        { [SV]: "a" },
        opts,
      );
      expect(deleteWins.deleteLocal).to.deep.equal([SV]);
    });

    it("prefers the vault's copy while a device joins, but keeps files only it has", () => {
      const local: LocalFiles = { [SV]: file("fresh-default", 9000), [MACROS]: file("mine") };
      const remote: RemoteFiles = { [SV]: file("configured", 1000), "Account/ACC/bindings-cache.wtf": file("k") };
      const plan = planSync(local, remote, { [SV]: "ignored while joining" }, { joining: true, now: 9999 });
      expect(plan.download).to.deep.equal([SV, "Account/ACC/bindings-cache.wtf"]);
      expect(plan.upload).to.deep.equal([MACROS]);
      expect(plan.deleteLocal).to.deep.equal([]);
      expect(plan.conflicts).to.deep.equal([SV]);
    });

    it("never touches paths sync doesn't carry", () => {
      const plan = planSync({ "Config.wtf": file("a") }, { "Config.wtf": file("b", 9000) }, {}, opts);
      expect(plan).to.deep.equal({ download: [], upload: [], deleteLocal: [], deleteRemote: [], conflicts: [] });
    });
  });

  describe("applyPlanToRemote / baseFromRemote", () => {
    it("records uploads and tombstones, and bases only on live files", () => {
      const local: LocalFiles = { [SV]: file("b", 3000) };
      const remote: RemoteFiles = { [SV]: file("a"), [MACROS]: file("m") };
      const plan = { download: [], upload: [SV], deleteLocal: [], deleteRemote: [MACROS], conflicts: [] };
      const next = applyPlanToRemote(local, remote, plan, { now: 7000 });
      expect(next[SV]).to.deep.equal(file("b", 3000));
      expect(next[MACROS]).to.deep.equal({ deleted: true, mtime: 7000 });
      expect(baseFromRemote(next)).to.deep.equal({ [SV]: "b" });
    });
  });
});
