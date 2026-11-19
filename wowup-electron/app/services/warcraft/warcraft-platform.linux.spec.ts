import { expect } from "chai";
import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";

import { InstalledProduct, WowClientType } from "wowup-lib-core";

import { WarcraftPlatformLinux } from "./warcraft-platform.linux";

const AGENT_PATH = "drive_c/ProgramData/Battle.net/Agent/product.db";

const FOREVER: InstalledProduct = {
  location: "C:/Program Files (x86)/World of Warcraft",
  name: "_forever_",
  clientType: WowClientType.Forever,
};

describe("WarcraftPlatformLinux blizzard agent search", () => {
  let home = "";

  function platform(): WarcraftPlatformLinux {
    return new WarcraftPlatformLinux({ homeDir: home });
  }

  /** Creates a product.db in the prefix at prefixDir (relative to home) and returns its path */
  async function addAgent(prefixDir: string): Promise<string> {
    const agentPath = path.join(home, prefixDir, AGENT_PATH);
    await fsp.mkdir(path.dirname(agentPath), { recursive: true });
    await fsp.writeFile(agentPath, "");
    return agentPath;
  }

  beforeEach(async () => {
    home = await fsp.realpath(await fsp.mkdtemp(path.join(os.tmpdir(), "wowup-linux-home-")));
  });

  afterEach(async () => {
    await fsp.rm(home, { recursive: true, force: true });
  });

  it("returns no path when there is no prefix", async () => {
    expect(await platform().getBlizzardAgentPaths()).to.deep.equal([]);
  });

  it("finds Battle.net in a Steam (Proton) prefix", async () => {
    const agentPath = await addAgent(".local/share/Steam/steamapps/compatdata/2544678653/pfx");

    expect(await platform().getBlizzardAgentPaths()).to.deep.equal([agentPath]);
  });

  it("finds Battle.net in an extra Steam library from libraryfolders.vdf", async () => {
    const library = path.join(home, "mnt", "games", "SteamLibrary");
    const agentPath = await addAgent("mnt/games/SteamLibrary/steamapps/compatdata/123/pfx");
    await fsp.mkdir(path.join(home, ".local/share/Steam/steamapps"), { recursive: true });
    await fsp.writeFile(
      path.join(home, ".local/share/Steam/steamapps/libraryfolders.vdf"),
      `"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"${library}"\n\t}\n}\n`,
    );

    expect(await platform().getBlizzardAgentPaths()).to.deep.equal([agentPath]);
  });

  it("finds Battle.net in a Lutris prefix under the configured game_path", async () => {
    const agentPath = await addAgent("Library/battlenet");
    await fsp.mkdir(path.join(home, ".config/lutris"), { recursive: true });
    await fsp.writeFile(path.join(home, ".config/lutris/system.yml"), "system:\n  game_path: ~/Library\n");

    expect(await platform().getBlizzardAgentPaths()).to.deep.equal([agentPath]);
  });

  it("finds Battle.net in ~/.wine, ~/Games and Bottles prefixes", async () => {
    for (const prefix of [".wine", "Games/battlenet", ".local/share/bottles/bottles/Battle.net"]) {
      await fsp.rm(home, { recursive: true, force: true });
      await fsp.mkdir(home);
      const agentPath = await addAgent(prefix);

      expect(await platform().getBlizzardAgentPaths()).to.deep.equal([agentPath]);
    }
  });

  it("returns the product.db of every prefix", async () => {
    const lutrisAgent = await addAgent("Games/battlenet");
    const steamAgent = await addAgent(".local/share/Steam/steamapps/compatdata/1/pfx");
    const wineAgent = await addAgent(".wine");

    expect(await platform().getBlizzardAgentPaths()).to.have.members([lutrisAgent, steamAgent, wineAgent]);
  });

  it("reports a prefix reached through a symlink only once", async () => {
    await addAgent(".local/share/Steam/steamapps/compatdata/1/pfx");
    await fsp.mkdir(path.join(home, ".steam"));
    await fsp.symlink(path.join(home, ".local/share/Steam"), path.join(home, ".steam/steam"));

    const prefixes = await platform().getWinePrefixes();

    expect(prefixes.filter((prefix) => prefix.endsWith(path.join("compatdata", "1", "pfx")))).to.have.length(1);
  });

  it("follows a symlinked prefix and returns the real product.db path", async () => {
    const realAgent = await addAgent("data/prefixes/battlenet");
    await fsp.mkdir(path.join(home, "Games"));
    await fsp.symlink(path.join(home, "data/prefixes/battlenet"), path.join(home, "Games/battlenet"));

    expect(await platform().getBlizzardAgentPaths()).to.deep.equal([realAgent]);
  });

  it("returns the real path when drive_c itself is a symlink", async () => {
    const realAgent = await addAgent("data/drive");
    await fsp.mkdir(path.join(home, ".wine"));
    await fsp.symlink(path.join(home, "data/drive/drive_c"), path.join(home, ".wine/drive_c"));

    expect(await platform().getBlizzardAgentPaths()).to.deep.equal([realAgent]);
  });

  it("reports a product.db shared by two prefixes only once", async () => {
    const realAgent = await addAgent(".wine");
    await fsp.mkdir(path.join(home, "Games/other"), { recursive: true });
    await fsp.symlink(path.join(home, ".wine/drive_c"), path.join(home, "Games/other/drive_c"));

    expect(await platform().getBlizzardAgentPaths()).to.deep.equal([realAgent]);
  });

  it("resolves a symlinked game folder to its real path", async () => {
    const realGame = path.join(home, "disk2", "World of Warcraft");
    await fsp.mkdir(realGame, { recursive: true });
    await fsp.mkdir(path.join(home, ".wine/drive_c/Program Files (x86)"), { recursive: true });
    await fsp.symlink(realGame, path.join(home, ".wine/drive_c/Program Files (x86)/World of Warcraft"));

    const [product] = platform().resolveProducts([FOREVER], path.join(home, ".wine", AGENT_PATH));

    expect(product.location).to.equal(realGame);
  });

  it("maps product locations into the prefix's drive_c", () => {
    const agentPath = path.join(home, ".wine", AGENT_PATH);

    const [forward, backslash] = platform().resolveProducts(
      [FOREVER, { ...FOREVER, location: "C:\\Program Files (x86)\\World of Warcraft" }],
      agentPath,
    );

    const expected = path.join(home, ".wine", "drive_c", "Program Files (x86)", "World of Warcraft");
    expect(forward.location).to.equal(expected);
    expect(backslash.location).to.equal(expected);
  });
});
