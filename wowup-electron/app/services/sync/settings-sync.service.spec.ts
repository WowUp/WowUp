import { expect } from "chai";
import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";

import { WowClientType, WowInstallation } from "wowup-lib-core";

import {
  SETTINGS_SYNC_ERROR_FOLDER_MISSING,
  SETTINGS_SYNC_ERROR_GAME_RUNNING,
  SETTINGS_SYNC_ERROR_NOT_CONFIGURED,
  SETTINGS_SYNC_ERROR_WRONG_KEY,
} from "../../../src/common/models/settings-sync";
import { SettingsSyncConfig, SettingsSyncService } from "./settings-sync.service";
import { createSyncCode } from "./sync-crypto";
import { FolderTransport, SYNC_FOLDER_NAME } from "./sync-transport";

const SV = "Account/ACC/SavedVariables/WeakAuras.lua";
const MACROS = "Account/ACC/macros-cache.txt";

interface Device {
  service: SettingsSyncService;
  wtf: string;
  config: SettingsSyncConfig;
  backups: string[];
  setTime(ms: number): void;
  setGameRunning(running: boolean): void;
}

describe("SettingsSyncService", () => {
  let root: string;
  let shared: string;

  beforeEach(async () => {
    root = await fsp.mkdtemp(path.join(os.tmpdir(), "wowup-sync-"));
    shared = path.join(root, "iCloud");
    await fsp.mkdir(shared);
  });

  afterEach(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  async function createDevice(name: string, code: string): Promise<Device> {
    const gameFolder = path.join(root, name, "World of Warcraft", "_forever_");
    const wtf = path.join(gameFolder, "WTF");
    await fsp.mkdir(wtf, { recursive: true });
    const installation = {
      id: `${name}-install`,
      clientType: WowClientType.Forever,
      location: path.join(gameFolder, "World of Warcraft.app"),
      label: "Forever",
    } as WowInstallation;

    let time = 10_000;
    let gameRunning = false;
    const backups: string[] = [];
    const config: SettingsSyncConfig = {
      code,
      folderPath: shared,
      autoSync: false,
      installationIds: [installation.id],
    };

    const service = new SettingsSyncService({
      getConfig: () => config,
      saveConfig: (changes) => Object.assign(config, changes),
      getInstallations: () => [installation],
      getTransport: (folderPath) => new FolderTransport(folderPath),
      getAddons: () => [{ id: "123", name: `${name} addon`, provider_name: "Wago" }],
      createBackup: () => {
        const backup = path.join(root, name, `backup-${backups.length}.zip`);
        backups.push(backup);
        return Promise.resolve(backup);
      },
      isGameRunning: () => Promise.resolve(gameRunning),
      stateFolderPath: path.join(root, name, "state"),
      deviceId: `${name}-id`,
      deviceName: name,
      now: () => time,
      log: { info: () => undefined, warn: () => undefined, error: () => undefined },
    });

    return {
      service,
      wtf,
      config,
      backups,
      setTime: (ms) => (time = ms),
      setGameRunning: (running) => (gameRunning = running),
    };
  }

  async function write(device: Device, relativePath: string, content: string, mtimeMs?: number): Promise<void> {
    const target = path.join(device.wtf, ...relativePath.split("/"));
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, content);
    if (mtimeMs !== undefined) {
      await fsp.utimes(target, new Date(mtimeMs), new Date(mtimeMs));
    }
  }

  async function read(device: Device, relativePath: string): Promise<string | undefined> {
    try {
      return await fsp.readFile(path.join(device.wtf, ...relativePath.split("/")), "utf8");
    } catch {
      return undefined;
    }
  }

  async function sharedFiles(): Promise<string[]> {
    const out: string[] = [];
    async function walk(dir: string) {
      for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else {
          out.push(full);
        }
      }
    }
    await walk(shared);
    return out;
  }

  it("seeds an empty vault, then brings a second device in line without losing its own files", async () => {
    const code = createSyncCode();
    const a = await createDevice("mac-a", code);
    const b = await createDevice("mac-b", code);

    await write(a, SV, "configured auras", 1_000);
    await write(a, "Config.wtf", "SET gxWindow 1");
    const first = await a.service.sync("mac-a-install");
    expect(first.outcome).to.equal("first-device");
    expect(first.uploaded).to.equal(1);

    // Mac B has fresh defaults, written later than A's settings, plus a macro only it has
    await write(b, SV, "fresh defaults", 50_000);
    await write(b, MACROS, "MACRO 1 Heal", 2_000);
    await write(b, "Config.wtf", "SET gxWindow 0");
    const joined = await b.service.sync("mac-b-install");

    expect(await read(b, SV)).to.equal("configured auras");
    expect(await read(b, "Config.wtf")).to.equal("SET gxWindow 0");
    expect(joined.uploaded).to.equal(1);
    expect(joined.conflicts).to.deep.equal([SV]);
    expect(joined.backupPath).to.equal(b.backups[0]);
    expect(joined.otherDevices.map((d) => d.deviceName)).to.deep.equal(["mac-a"]);

    const back = await a.service.sync("mac-a-install");
    expect(back.downloaded).to.equal(1);
    expect(await read(a, MACROS)).to.equal("MACRO 1 Heal");
    expect(await read(a, "Config.wtf")).to.equal("SET gxWindow 1");
  });

  it("carries edits and deletions, and the newest edit wins a conflict", async () => {
    const code = createSyncCode();
    const a = await createDevice("mac-a", code);
    const b = await createDevice("mac-b", code);
    await write(a, SV, "v1", 1_000);
    await write(a, MACROS, "m1", 1_000);
    await a.service.sync("mac-a-install");
    await b.service.sync("mac-b-install");

    await write(a, SV, "v2 from a", 3_000);
    await fsp.rm(path.join(a.wtf, ...MACROS.split("/")));
    a.setTime(4_000);
    const pushed = await a.service.sync("mac-a-install");
    expect(pushed.uploaded).to.equal(1);
    expect(pushed.deletedRemote).to.equal(1);

    await write(b, SV, "v2 from b, older", 2_000);
    const pulled = await b.service.sync("mac-b-install");
    expect(pulled.conflicts).to.deep.equal([SV]);
    expect(await read(b, SV)).to.equal("v2 from a");
    expect(await read(b, MACROS)).to.equal(undefined);

    const quiet = await b.service.sync("mac-b-install");
    expect(quiet.outcome).to.equal("no-changes");
    // one backup when b joined, one before this pull; none for a sync that changed nothing
    expect(b.backups.length).to.equal(2);
  });

  it("stores nothing readable in the shared folder", async () => {
    const a = await createDevice("mac-a", createSyncCode());
    await write(a, SV, "SECRET_AURA_STRING");
    await a.service.sync("mac-a-install");

    const files = await sharedFiles();
    expect(files.length).to.be.greaterThan(1);
    for (const file of files) {
      expect(path.relative(path.join(shared, SYNC_FOLDER_NAME), file)).to.not.match(/WeakAuras|Account|Forever/);
      expect((await fsp.readFile(file)).includes(Buffer.from("SECRET_AURA_STRING"))).to.equal(false);
    }
  });

  it("keeps devices with different codes apart", async () => {
    const a = await createDevice("mac-a", createSyncCode());
    const b = await createDevice("mac-b", createSyncCode());
    await write(a, SV, "a's");
    await a.service.sync("mac-a-install");
    const other = await b.service.sync("mac-b-install");
    expect(other.outcome).to.equal("first-device");
    expect(await read(b, SV)).to.equal(undefined);
  });

  it("reseeds a wiped vault instead of deleting local files", async () => {
    const a = await createDevice("mac-a", createSyncCode());
    await write(a, SV, "keep me");
    await a.service.sync("mac-a-install");
    await fsp.rm(path.join(shared, SYNC_FOLDER_NAME), { recursive: true });

    const reseeded = await a.service.sync("mac-a-install");
    expect(reseeded.outcome).to.equal("first-device");
    expect(reseeded.deletedLocal).to.equal(0);
    expect(await read(a, SV)).to.equal("keep me");
  });

  it("refuses to sync while the game runs, without a code, or when the folder is gone", async () => {
    const a = await createDevice("mac-a", createSyncCode());
    a.setGameRunning(true);
    await expectError(a.service.sync("mac-a-install"), SETTINGS_SYNC_ERROR_GAME_RUNNING);
    a.setGameRunning(false);

    a.config.folderPath = path.join(root, "unplugged");
    await expectError(a.service.sync("mac-a-install"), SETTINGS_SYNC_ERROR_FOLDER_MISSING);

    a.config.code = undefined;
    await expectError(a.service.sync("mac-a-install"), SETTINGS_SYNC_ERROR_NOT_CONFIGURED);
  });

  it("rejects a vault sealed with another key at the same place", async () => {
    const a = await createDevice("mac-a", createSyncCode());
    await write(a, SV, "x");
    await a.service.sync("mac-a-install");
    const [manifest] = (await sharedFiles()).filter((f) => f.endsWith("manifest"));
    const corrupt = await fsp.readFile(manifest);
    corrupt[corrupt.length - 1] ^= 1;
    await fsp.writeFile(manifest, corrupt);
    await expectError(a.service.sync("mac-a-install"), SETTINGS_SYNC_ERROR_WRONG_KEY);
  });

  it("finds the other device's vault without the exact same folder being picked", async () => {
    const code = createSyncCode();
    const a = await createDevice("mac-a", code);
    await write(a, SV, "configured auras", 1_000);
    await a.service.sync("mac-a-install");

    const nested = path.join(shared, SYNC_FOLDER_NAME, SYNC_FOLDER_NAME);
    await fsp.mkdir(nested, { recursive: true });
    const picks = {
      "the WowUp Sync folder itself": path.join(shared, SYNC_FOLDER_NAME),
      "a WowUp Sync folder made inside it by mistake": nested,
      "a folder further up": root,
    };
    for (const [label, folder] of Object.entries(picks)) {
      const device = await createDevice(`mac-${Object.keys(picks).indexOf(label)}-b`, code);
      device.config.folderPath = folder;
      await write(device, MACROS, "MACRO 1 Heal", 2_000);
      const result = await device.service.sync(`mac-${Object.keys(picks).indexOf(label)}-b-install`);
      expect(result.outcome, label).to.equal("synced");
      expect(await read(device, SV), label).to.equal("configured auras");
      expect(await read(device, MACROS), label).to.equal("MACRO 1 Heal");
    }
    // Nothing was started next to the real vault
    expect(await fsp.readdir(nested)).to.deep.equal([]);
  });

  it("points out a vault of another code in the folder when a device starts its own", async () => {
    const a = await createDevice("mac-a", createSyncCode());
    const b = await createDevice("mac-b", createSyncCode());
    await write(a, SV, "configured auras", 1_000);
    expect((await a.service.sync("mac-a-install")).otherCodesInFolder).to.equal(0);

    await write(b, SV, "fresh defaults", 500);
    const result = await b.service.sync("mac-b-install");
    expect(result.outcome).to.equal("first-device");
    expect(result.otherCodesInFolder).to.equal(1);
  });

  it("never deletes files the vault never had, even with state from before vault folders were recorded", async () => {
    const code = createSyncCode();
    const a = await createDevice("mac-a", code);
    const b = await createDevice("mac-b", code);

    await write(a, SV, "configured auras", 1_000);
    await a.service.sync("mac-a-install");

    const elsewhere = path.join(root, "Dropbox");
    await fsp.mkdir(elsewhere);
    b.config.folderPath = elsewhere;
    await write(b, SV, "fresh defaults", 500);
    await write(b, MACROS, "MACRO 1 Heal", 2_000);
    await b.service.sync("mac-b-install");

    // Drop the recorded folder, as in state files written by earlier builds
    const stateFile = path.join(root, "mac-b", "state", "mac-b-install.json");
    const state = JSON.parse(await fsp.readFile(stateFile, "utf8")) as { location?: string };
    delete state.location;
    await fsp.writeFile(stateFile, JSON.stringify(state));

    b.config.folderPath = shared;
    await b.service.sync("mac-b-install");
    expect(await read(b, SV)).to.equal("configured auras");
    expect(await read(b, MACROS)).to.equal("MACRO 1 Heal");
  });
});

async function expectError(promise: Promise<unknown>, message: string): Promise<void> {
  try {
    await promise;
  } catch (e) {
    expect((e as Error).message).to.equal(message);
    return;
  }
  expect.fail(`expected ${message}`);
}
