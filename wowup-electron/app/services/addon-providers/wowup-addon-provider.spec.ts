import { expect } from "chai";
import { GetAddonsByFingerprintResponse } from "wowup-lib-core";

import { NetworkInterface, PostConfig } from "../network/network-interface";
import { WowUpAddonProvider } from "./wowup-addon-provider";

function createProvider(response: Partial<GetAddonsByFingerprintResponse>) {
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
