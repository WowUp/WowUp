import { expect } from "chai";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";

import type { Net } from "electron";

import { DownloadFileDeps, DownloadLogger, WritableLike, describeError, downloadFile } from "./file-download";

class FakeRequest extends EventEmitter {
  public readonly headers: Record<string, string> = {};
  public aborted = false;
  public ended = false;
  public followedRedirects = 0;

  public setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  public followRedirect(): void {
    this.followedRedirects += 1;
  }

  public abort(): void {
    this.aborted = true;
  }

  public end(): void {
    this.ended = true;
  }
}

class FakeResponse extends EventEmitter {
  public constructor(
    public readonly statusCode: number,
    public readonly headers: Record<string, string> = {},
  ) {
    super();
  }
}

class FakeWriter implements WritableLike {
  public readonly chunks: Buffer[] = [];
  public endCalled = false;
  private _errorListener?: (err: Error) => void;

  public write(chunk: Buffer, callback?: () => void): boolean {
    this.chunks.push(chunk);
    callback?.();
    return true;
  }

  public end(): void {
    this.endCalled = true;
  }

  public on(event: "error", listener: (err: Error) => void): void {
    if (event === "error") {
      this._errorListener = listener;
    }
  }

  public emitError(err: Error): void {
    this._errorListener?.(err);
  }

  public get contents(): string {
    return Buffer.concat(this.chunks).toString("utf-8");
  }
}

interface LogLine {
  level: string;
  text: string;
}

function createFakeLog(): { log: DownloadLogger; lines: LogLine[] } {
  const lines: LogLine[] = [];
  function record(level: string) {
    return (...args: unknown[]) => {
      lines.push({ level, text: args.map((a) => String(a)).join(" ") });
    };
  }

  return {
    lines,
    log: { debug: record("debug"), info: record("info"), warn: record("warn"), error: record("error") },
  };
}

function createFakeNet(): { net: Pick<Net, "request">; requests: FakeRequest[]; urls: string[] } {
  const requests: FakeRequest[] = [];
  const urls: string[] = [];
  const net = {
    request: (options: { url: string }) => {
      urls.push(options.url);
      const req = new FakeRequest();
      requests.push(req);
      return req;
    },
  };

  return { net: net as unknown as Pick<Net, "request">, requests, urls };
}

/** The request is only created after an async mkdir, so tests have to wait for it to show up. */
async function waitFor<T>(get: () => T | undefined, label: string, timeoutMs = 2000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = get();
    if (value !== undefined) {
      return value;
    }
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for " + label);
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

async function expectRejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (err) {
    return err as Error;
  }
  throw new Error("Expected the download to reject, but it resolved");
}

describe("file-download", () => {
  let outputFolder = "";

  beforeEach(async () => {
    outputFolder = await fsp.mkdtemp(path.join(os.tmpdir(), "wowup-dl-test-"));
  });

  afterEach(async () => {
    await fsp.rm(outputFolder, { recursive: true, force: true });
  });

  describe("describeError", () => {
    it("appends the code and errno a bare message leaves out", () => {
      // This is the shape of the Chromium failure users were reporting: the message on its own
      // ("net::ERR_FAILED") does not distinguish it from any other network-layer failure.
      const err = Object.assign(new Error("net::ERR_FAILED"), { code: "ERR_FAILED", errno: -2 });

      expect(describeError(err)).to.equal("net::ERR_FAILED code=ERR_FAILED errno=-2");
    });

    it("includes the syscall for node socket and fs errors", () => {
      const err = Object.assign(new Error("connect ECONNREFUSED"), {
        code: "ECONNREFUSED",
        errno: -4078,
        syscall: "connect",
      });

      expect(describeError(err)).to.equal("connect ECONNREFUSED code=ECONNREFUSED errno=-4078 syscall=connect");
    });

    it("returns just the message when there is nothing else attached", () => {
      expect(describeError(new Error("boom"))).to.equal("boom");
    });

    it("stringifies values that are not errors", () => {
      expect(describeError("nope")).to.equal("nope");
      expect(describeError(undefined)).to.equal("undefined");
    });
  });

  describe("downloadFile", () => {
    let fakeNet: ReturnType<typeof createFakeNet>;
    let fakeLog: ReturnType<typeof createFakeLog>;
    let writer: FakeWriter;
    let deps: DownloadFileDeps;

    beforeEach(() => {
      fakeNet = createFakeNet();
      fakeLog = createFakeLog();
      writer = new FakeWriter();
      deps = {
        net: fakeNet.net,
        log: fakeLog.log,
        responseTimeoutMs: 2000,
        stallTimeoutMs: 2000,
        createWriteStream: () => writer,
      };
    });

    const start = (overrides: Partial<Parameters<typeof downloadFile>[0]> = {}) =>
      downloadFile(
        { url: "https://edge.forgecdn.net/files/1/2/addon.zip", fileName: "addon.zip", outputFolder, ...overrides },
        deps,
      );

    async function respond(statusCode: number, headers: Record<string, string> = {}): Promise<FakeResponse> {
      const req = await waitFor(() => fakeNet.requests[0], "the request");
      const response = new FakeResponse(statusCode, headers);
      req.emit("response", response);
      return response;
    }

    function errorLines(): string[] {
      return fakeLog.lines.filter((l) => l.level === "error").map((l) => l.text);
    }

    it("resolves with a save path under the output folder", async () => {
      const promise = start();
      const response = await respond(200, { "content-length": "4" });
      response.emit("data", Buffer.from("abcd"));
      response.emit("end");

      const savePath = await promise;

      expect(path.dirname(savePath)).to.equal(outputFolder);
      expect(savePath.endsWith("addon.zip")).to.equal(true);
      expect(writer.contents).to.equal("abcd");
      expect(writer.endCalled).to.equal(true);
    });

    it("prefixes the file name so concurrent downloads cannot collide", async () => {
      const first = start();
      const firstResponse = await respond(200);
      firstResponse.emit("end");
      const firstPath = await first;

      fakeNet.requests.length = 0;
      const second = start();
      const secondResponse = await respond(200);
      secondResponse.emit("end");
      const secondPath = await second;

      expect(firstPath).to.not.equal(secondPath);
    });

    it("creates the output folder when it does not exist", async () => {
      const nested = path.join(outputFolder, "a", "b");
      const promise = start({ outputFolder: nested });
      const response = await respond(200);
      response.emit("end");
      await promise;

      expect(fs.existsSync(nested)).to.equal(true);
    });

    it("sets the auth headers on the request", async () => {
      const promise = start({ auth: { headers: { "X-Api-Key": "$2a$10$secret" } } });
      const req = await waitFor(() => fakeNet.requests[0], "the request");

      expect(req.headers["X-Api-Key"]).to.equal("$2a$10$secret");

      const response = new FakeResponse(200);
      req.emit("response", response);
      response.emit("end");
      await promise;
    });

    it("never logs the full header value", async () => {
      const promise = start({ auth: { headers: { "X-Api-Key": "$2a$10$secret" } } });
      const response = await respond(200);
      response.emit("end");
      await promise;

      const headerLog = fakeLog.lines.find((l) => l.text.includes("Setting header"));
      expect(headerLog?.text).to.equal("Setting header: X-Api-Key=$2a***");
      expect(fakeLog.lines.some((l) => l.text.includes("secret"))).to.equal(false);
    });

    it("appends auth query params to the url", async () => {
      const promise = start({ auth: { queryParams: { token: "abc123" } } });
      await waitFor(() => fakeNet.urls[0], "the request url");

      expect(fakeNet.urls[0]).to.equal("https://edge.forgecdn.net/files/1/2/addon.zip?token=abc123");

      const response = await respond(200);
      response.emit("end");
      await promise;
    });

    it("follows redirects", async () => {
      const promise = start();
      const req = await waitFor(() => fakeNet.requests[0], "the request");
      req.emit("redirect", 302, "GET", "https://mediafilez.forgecdn.net/files/1/2/addon.zip");

      expect(req.followedRedirects).to.equal(1);

      const response = new FakeResponse(200);
      req.emit("response", response);
      response.emit("end");
      await promise;
    });

    it("rejects on a non-2xx response", async () => {
      const promise = start();
      const response = await respond(403);
      response.emit("end");

      const err = await expectRejection(promise);
      expect(err.message).to.contain("Invalid response (403)");
    });

    it("rejects, aborts and logs the error code when the request fails", async () => {
      const promise = start();
      const req = await waitFor(() => fakeNet.requests[0], "the request");
      req.emit("error", Object.assign(new Error("net::ERR_FAILED"), { code: "ERR_FAILED", errno: -2 }));

      const err = await expectRejection(promise);

      expect(err.message).to.equal("net::ERR_FAILED");
      expect(req.aborted).to.equal(true);
      expect(writer.endCalled).to.equal(true);
      expect(errorLines().some((t) => t.includes("code=ERR_FAILED") && t.includes("errno=-2"))).to.equal(true);
    });

    it("rejects when the response stream errors", async () => {
      const promise = start();
      const response = await respond(200);
      response.emit("error", new Error("stream blew up"));

      const err = await expectRejection(promise);
      expect(err.message).to.equal("stream blew up");
    });

    it("rejects when writing to disk fails instead of throwing an unhandled stream error", async () => {
      const promise = start();
      const response = await respond(200, { "content-length": "4" });
      response.emit("data", Buffer.from("abcd"));
      writer.emitError(Object.assign(new Error("ENOSPC: no space left on device"), { code: "ENOSPC" }));

      const err = await expectRejection(promise);

      expect(err.message).to.contain("ENOSPC");
      expect(errorLines().some((t) => t.includes("write failed") && t.includes("code=ENOSPC"))).to.equal(true);
    });

    it("rejects when the server never responds", async () => {
      deps.responseTimeoutMs = 30;
      const promise = start();
      const req = await waitFor(() => fakeNet.requests[0], "the request");

      const err = await expectRejection(promise);

      expect(err.message).to.contain("Download timed out (no response, 30ms)");
      expect(req.aborted).to.equal(true);
    });

    it("re-arms the response deadline after a redirect", async () => {
      deps.responseTimeoutMs = 80;
      const promise = start();
      const req = await waitFor(() => fakeNet.requests[0], "the request");

      await new Promise((resolve) => setTimeout(resolve, 50));
      req.emit("redirect", 302, "GET", "https://mediafilez.forgecdn.net/files/1/2/addon.zip");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Past the original deadline, but the redirect reset it, so this still succeeds.
      const response = new FakeResponse(200);
      req.emit("response", response);
      response.emit("end");

      await promise;
    });

    it("rejects when the response starts but then stalls", async () => {
      deps.stallTimeoutMs = 40;
      const promise = start();
      const response = await respond(200, { "content-length": "100" });
      response.emit("data", Buffer.from("abcd"));

      const err = await expectRejection(promise);
      expect(err.message).to.contain("Download timed out (stalled, 40ms)");
    });

    it("does not time out a slow download that keeps sending data", async () => {
      deps.stallTimeoutMs = 100;
      const promise = start();
      const response = await respond(200, { "content-length": "5" });

      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        response.emit("data", Buffer.from("x"));
      }
      response.emit("end");

      await promise;
      expect(writer.contents).to.equal("xxxxx");
    });

    it("ignores a late error once the download has already succeeded", async () => {
      const promise = start();
      const req = await waitFor(() => fakeNet.requests[0], "the request");
      const response = new FakeResponse(200);
      req.emit("response", response);
      response.emit("end");

      const savePath = await promise;
      req.emit("error", new Error("too late"));

      expect(savePath.endsWith("addon.zip")).to.equal(true);
    });

    it("writes to a real file on disk", async () => {
      // The rest of the suite uses a fake writer; this one proves the default path actually
      // opens the save path through fs.
      delete deps.createWriteStream;

      const promise = start();
      const response = await respond(200, { "content-length": "4" });
      response.emit("data", Buffer.from("abcd"));
      response.emit("end");

      const savePath = await promise;

      // NOTE: downloadFile does not await the stream flush before resolving, so the file can
      // still be short here for a tick or two.
      const contents = await waitFor(() => {
        const text = fs.readFileSync(savePath, "utf-8");
        return text.length === 4 ? text : undefined;
      }, "the file contents to flush");

      expect(contents).to.equal("abcd");
    });
  });
});
