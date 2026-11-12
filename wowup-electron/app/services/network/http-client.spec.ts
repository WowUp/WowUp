import { expect } from "chai";

import { HttpClient, HttpError } from "./http-client";

interface SentRequest {
  url: string;
  init: RequestInit;
}

function createClient(response: () => Response) {
  const sent: SentRequest[] = [];
  const logged: string[] = [];
  let clock = 1000;
  const client = new HttpClient({
    fetch: (url, init) => {
      sent.push({ url, init });
      clock += 25;
      return Promise.resolve(response());
    },
    log: { info: (line: unknown) => logged.push(String(line)) },
    now: () => clock,
  });
  return { client, sent, logged };
}

describe("HttpClient", () => {
  it("should get json without caching and log the request like the renderer did", async () => {
    const { client, sent, logged } = createClient(() => new Response(JSON.stringify({ id: 5 }), { status: 200 }));

    const body = await client.getJson<{ id: number }>("https://hub.test/addons/5", { "X-Extra": ["a", "b"] }, 500);

    expect(body).to.deep.equal({ id: 5 });
    expect(sent[0].url).to.equal("https://hub.test/addons/5");
    expect(sent[0].init.method).to.equal("GET");
    expect(sent[0].init.headers).to.deep.equal({ "Cache-Control": "no-cache", Pragma: "no-cache", "X-Extra": "a,b" });
    expect(sent[0].init.signal).to.be.instanceOf(AbortSignal);
    expect(logged).to.deep.equal(["[GET] https://hub.test/addons/5 200 25ms"]);
  });

  it("should post the body as json", async () => {
    const { client, sent } = createClient(() => new Response("[]", { status: 200 }));

    await client.postJson("https://hub.test/addons/fingerprint", { fingerprints: ["abc"] }, { "X-Id": "1" });

    expect(sent[0].init.method).to.equal("POST");
    expect(sent[0].init.body).to.equal('{"fingerprints":["abc"]}');
    expect(sent[0].init.headers).to.deep.equal({ "Content-Type": "application/json", "X-Id": "1" });
    expect(sent[0].init.signal).to.equal(undefined);
  });

  it("should reject a non-2xx response with its status", async () => {
    const { client } = createClient(() => new Response("gone", { status: 404, statusText: "Not Found" }));

    const error = await client.getText("https://hub.test/missing").catch((e: unknown) => e);

    expect(error).to.be.instanceOf(HttpError);
    expect((error as HttpError).status).to.equal(404);
    expect((error as HttpError).url).to.equal("https://hub.test/missing");
  });

  it("should hand back the headers of a HEAD request", async () => {
    const { client, sent } = createClient(
      () => new Response(null, { status: 200, headers: { "content-type": "application/zip" } }),
    );

    const headers = await client.head(new URL("https://files.test/addon.zip"));

    expect(sent[0].init.method).to.equal("HEAD");
    expect(headers.get("content-type")).to.equal("application/zip");
  });
});
