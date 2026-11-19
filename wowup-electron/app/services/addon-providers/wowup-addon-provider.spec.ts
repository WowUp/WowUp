import { expect } from "chai";
import { GetAddonsByFingerprintResponse, WowClientType, WowGameType, WowInstallation } from "wowup-lib-core";

import { NetworkInterface, PostConfig } from "../network/network-interface";
import { WowUpAddonProvider } from "./wowup-addon-provider";

/** `response` is what every POST answers, a fingerprint or a batch response */
function createProvider(response: Partial<GetAddonsByFingerprintResponse> | { addons: unknown[] }) {
  const posts: { url: string; config: PostConfig }[] = [];
  const network: NetworkInterface = {
    getJson: () => Promise.reject(new Error("unexpected GET")),
    getText: () => Promise.reject(new Error("unexpected GET")),
    postJson: <T>(url: string | URL, config: PostConfig) => {
      posts.push({ url: url.toString(), config });
      return Promise.resolve(response as T);
    },
  };
  const provider = new WowUpAddonProvider("https://hub.test", "https://site.test", network);
  return { provider, posts };
}

function exactMatch(id: number, fingerprints: string[]) {
  return {
    id,
    matched_release: {
      addonFolders: fingerprints.map((fingerprint, i) => ({ id: i, folder_name: `F${i}`, fingerprint })),
    },
  } as any;
}

describe("WowUpAddonProvider.getAddonIdsByFingerprints", () => {
  it("maps each known fingerprint to its hub addon id", async () => {
    const { provider, posts } = createProvider({
      exactMatches: [exactMatch(50, ["aaa"]), exactMatch(77, ["bbb", "not-asked"])],
    });

    const ids = await provider.getAddonIdsByFingerprints(["aaa", "bbb", "ccc", "aaa"]);

    expect(posts).to.deep.equal([
      { url: "https://hub.test/addons/fingerprint", config: { body: { fingerprints: ["aaa", "bbb", "ccc"] } } },
    ]);
    expect(Array.from(ids.entries())).to.deep.equal([
      ["aaa", "50"],
      ["bbb", "77"],
    ]);
  });

  it("keeps the first match when a fingerprint is shared", async () => {
    const { provider } = createProvider({ exactMatches: [exactMatch(1, ["aaa"]), exactMatch(2, ["aaa"])] });

    const ids = await provider.getAddonIdsByFingerprints(["aaa"]);

    expect(ids.get("aaa")).to.equal("1");
  });

  it("skips the request when there is nothing to look up", async () => {
    const { provider, posts } = createProvider({ exactMatches: [] });

    const ids = await provider.getAddonIdsByFingerprints(["", ""]);

    expect(posts).to.have.length(0);
    expect(ids.size).to.equal(0);
  });

  it("tolerates releases without folders", async () => {
    const { provider } = createProvider({ exactMatches: [{ id: 3 } as any] });

    const ids = await provider.getAddonIdsByFingerprints(["aaa"]);

    expect(ids.size).to.equal(0);
  });
});

describe("WowUpAddonProvider.getAllBatch game versions", () => {
  const retail = { id: "inst-1", clientType: WowClientType.Retail } as WowInstallation;

  function gameVersion(iface: string, interfaces?: string[]) {
    return {
      game_type: WowGameType.Retail,
      interface: iface,
      interfaces,
      title: "Raider.IO",
      version: "1",
      authors: "",
    };
  }

  async function getLatestFile(gameVersions: ReturnType<typeof gameVersion>[]) {
    const { provider } = createProvider({
      addons: [
        {
          id: 1,
          repository_name: "raiderio",
          releases: [
            { id: 10, download_url: "https://dl.test", published_at: new Date(), game_versions: gameVersions },
          ],
        },
      ],
    });

    const result = await provider.getAllBatch([retail], ["1"]);
    return result.installationResults["inst-1"][0].files?.[0];
  }

  it("lists every interface the hub sends for the game type", async () => {
    const file = await getLatestFile([
      gameVersion("120107", ["120107", "120105"]),
      gameVersion("120107", ["120107", "120105"]),
    ]);

    expect(file?.gameVersions).to.deep.equal(["12.1.7", "12.1.5"]);
  });

  it("falls back to the single interface from older hubs", async () => {
    const file = await getLatestFile([gameVersion("120107"), gameVersion("120105")]);

    expect(file?.gameVersions).to.deep.equal(["12.1.7", "12.1.5"]);
  });
});
