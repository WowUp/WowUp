import { expect } from "chai";
import { SourceRemovedAddonError, WowClientType, WowInstallation } from "wowup-lib-core";

import { PREF_GITHUB_PERSONAL_ACCESS_TOKEN } from "../../../src/common/constants";
import { GitHubFetchRepositoryError, GitHubLimitError } from "../../../src/common/errors";
import { HttpClient } from "../network/http-client";
import { GitHubAddonProvider } from "./github-addon-provider";

const silentLog = { info: () => undefined };
const installation = { id: "inst-1", clientType: WowClientType.Retail } as WowInstallation;

function createProvider(respond: (url: string, init: RequestInit) => Response, pat = "") {
  const requests: { url: string; init: RequestInit }[] = [];
  const http = new HttpClient({
    fetch: (url, init) => {
      requests.push({ url, init });
      return Promise.resolve(respond(url, init));
    },
    log: silentLog,
  });
  const provider = new GitHubAddonProvider(http, (key) =>
    key === PREF_GITHUB_PERSONAL_ACCESS_TOKEN ? pat : undefined,
  );
  return { provider, requests };
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (e) {
    return e;
  }
  throw new Error("expected a rejection");
}

describe("GitHubAddonProvider", () => {
  let consoleError: typeof console.error;
  beforeEach(() => {
    consoleError = console.error;
    console.error = () => undefined;
  });
  afterEach(() => {
    console.error = consoleError;
  });

  describe("getDownloadAuth", () => {
    // Regression test for #1520. The asset endpoint returns 200 with a JSON metadata body
    // unless this header is present, and that body gets written to disk as the addon zip.
    it("sends the octet-stream accept header with no personal access token", async () => {
      const { provider } = createProvider(() => new Response("{}"));

      const auth = await provider.getDownloadAuth();

      expect(auth?.headers?.Accept).to.equal("application/octet-stream");
      expect(auth?.headers?.Authorization).to.equal(undefined);
    });

    it("sends the octet-stream accept header with a personal access token", async () => {
      const { provider } = createProvider(() => new Response("{}"), "test-token");

      const auth = await provider.getDownloadAuth();

      expect(auth?.headers?.Accept).to.equal("application/octet-stream");
      expect(auth?.headers?.Authorization).to.equal("Bearer test-token");
    });
  });

  describe("api errors", () => {
    it("turns an exhausted rate limit into GitHubLimitError", async () => {
      const { provider } = createProvider(
        () =>
          new Response("{}", {
            status: 403,
            headers: {
              "x-ratelimit-limit": "60",
              "x-ratelimit-used": "60",
              "x-ratelimit-remaining": "0",
              "x-ratelimit-reset": "1700000000",
            },
          }),
      );

      const error = await rejectionOf(provider.getById("owner/repo", installation));

      expect(error).to.be.instanceOf(GitHubLimitError);
      expect((error as GitHubLimitError).rateLimitMax).to.equal(60);
      expect((error as GitHubLimitError).rateLimitReset).to.equal(1700000000);
    });

    it("turns a missing repository into SourceRemovedAddonError", async () => {
      const { provider } = createProvider(() => new Response("{}", { status: 404 }));

      const error = await rejectionOf(provider.getById("owner/repo", installation));

      expect(error).to.be.instanceOf(SourceRemovedAddonError);
    });

    it("wraps other failures in GitHubFetchRepositoryError", async () => {
      const { provider } = createProvider(() => new Response("{}", { status: 500 }));

      const error = await rejectionOf(provider.getById("owner/repo", installation));

      expect(error).to.be.instanceOf(GitHubFetchRepositoryError);
    });

    it("sends the personal access token to the api", async () => {
      const { provider, requests } = createProvider(() => new Response("{}", { status: 404 }), "test-token");

      await rejectionOf(provider.getById("owner/repo", installation));

      expect((requests[0].init.headers as Record<string, string>).Authorization).to.equal("Bearer test-token");
    });
  });
});
