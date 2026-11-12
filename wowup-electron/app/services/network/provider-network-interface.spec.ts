import { expect } from "chai";
import NodeCache = require("node-cache");

import { HttpCircuitBreaker } from "./circuit-breaker";
import { ProviderNetworkInterface } from "./provider-network-interface";

function createBreaker() {
  const calls: { method: string; url: string; headers?: unknown; body?: unknown }[] = [];
  const breaker = {
    getJson: (url: string, headers: unknown) => {
      calls.push({ method: "getJson", url, headers });
      return Promise.resolve({ n: calls.length });
    },
    getText: (url: string) => {
      calls.push({ method: "getText", url });
      return Promise.resolve(`text ${calls.length}`);
    },
    postJson: (url: string, body: unknown, headers: unknown) => {
      calls.push({ method: "postJson", url, body, headers });
      return Promise.resolve({ n: calls.length });
    },
  } as unknown as HttpCircuitBreaker;
  return { breaker, calls };
}

describe("ProviderNetworkInterface", () => {
  it("should add the default headers to each request", async () => {
    const { breaker, calls } = createBreaker();
    const network = new ProviderNetworkInterface(breaker, new NodeCache(), { "X-WowUp-Install-Id": "install-1" });

    await network.getJson("https://hub.test/a", { headers: { Accept: "application/json" } });

    expect(calls[0].headers).to.deep.equal({ "X-WowUp-Install-Id": "install-1", Accept: "application/json" });
  });

  it("should send a repeated get once", async () => {
    const { breaker, calls } = createBreaker();
    const network = new ProviderNetworkInterface(breaker, new NodeCache());

    const first = await network.getJson("https://hub.test/a");
    const second = await network.getJson("https://hub.test/a");

    expect(second).to.deep.equal(first);
    expect(calls.length).to.equal(1);
  });

  it("should cache a post only when asked to", async () => {
    const { breaker, calls } = createBreaker();
    const network = new ProviderNetworkInterface(breaker, new NodeCache());

    await network.postJson("https://hub.test/p", { body: { a: 1 } });
    await network.postJson("https://hub.test/p", { body: { a: 1 } });
    await network.postJson("https://hub.test/p", { body: { a: 1 }, cache: true });
    await network.postJson("https://hub.test/p", { body: { a: 1 }, cache: true });

    expect(calls.length).to.equal(3);
  });
});
