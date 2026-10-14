import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";

import { nanoid } from "nanoid";
import type { Net } from "electron";
import type { DownloadAuth } from "wowup-lib-core";

// Downloads have no timeout of their own, so a connection that opens and then goes nowhere
// hangs the install forever. Split into "server must start responding" and "server must keep
// sending" so a slow-but-alive transfer of a large addon is not cut off.
export const DOWNLOAD_RESPONSE_TIMEOUT_MS = 30000;
export const DOWNLOAD_STALL_TIMEOUT_MS = 60000;

export interface DownloadFileOptions {
  url: string;
  fileName: string;
  outputFolder: string;
  auth?: DownloadAuth;
}

export interface DownloadLogger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface WritableLike {
  write(chunk: Buffer, callback?: () => void): boolean;
  end(): void;
  on(event: "error", listener: (err: Error) => void): void;
}

export interface DownloadFileDeps {
  net: Pick<Net, "request">;
  log: DownloadLogger;
  responseTimeoutMs?: number;
  stallTimeoutMs?: number;
  createWriteStream?: (filePath: string) => WritableLike;
}

// `net::ERR_FAILED` on its own says almost nothing, and it is what users end up pasting into
// bug reports. Surface whatever code/errno the Chromium or Node layer attached to the error so
// a download failure can actually be told apart from the next one.
export function describeError(err: unknown): string {
  if (!(err instanceof Error)) {
    return String(err);
  }

  const details = err as Error & { code?: string | number; errno?: number; syscall?: string };
  const parts = [details.message];

  if (details.code !== undefined) {
    parts.push(`code=${details.code}`);
  }
  if (details.errno !== undefined) {
    parts.push(`errno=${details.errno}`);
  }
  if (details.syscall !== undefined) {
    parts.push(`syscall=${details.syscall}`);
  }

  return parts.join(" ");
}

/**
 * Downloads a URL into the given folder, prefixing the file name so concurrent downloads of the
 * same addon cannot collide. Resolves with the saved path.
 */
export async function downloadFile(options: DownloadFileOptions, deps: DownloadFileDeps): Promise<string> {
  const { net, log } = deps;
  const responseTimeoutMs = deps.responseTimeoutMs ?? DOWNLOAD_RESPONSE_TIMEOUT_MS;
  const stallTimeoutMs = deps.stallTimeoutMs ?? DOWNLOAD_STALL_TIMEOUT_MS;
  const createWriteStream = deps.createWriteStream ?? ((filePath: string) => fs.createWriteStream(filePath));

  await fsp.mkdir(options.outputFolder, { recursive: true });

  const downloadUrl = new URL(options.url);
  if (typeof options.auth?.queryParams === "object") {
    for (const [key, value] of Object.entries(options.auth.queryParams)) {
      downloadUrl.searchParams.set(key, value);
    }
  }

  const savePath = path.join(options.outputFolder, `${nanoid()}-${options.fileName}`);
  const url = downloadUrl.toString();
  log.info(`[DownloadFile] '${url}' -> '${savePath}'`);

  const writer = createWriteStream(savePath);

  try {
    await new Promise<void>((resolve, reject) => {
      let size = 0;
      let percentMod = -1;
      let settled = false;
      let timer: NodeJS.Timeout | undefined;

      const req = net.request({
        url,
        redirect: "manual",
      });

      // Settle exactly once, and abort the request so a dead/stalled connection stops
      // streaming into a writer we are about to close.
      const fail = (err: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        try {
          req.abort();
        } catch (abortErr) {
          log.warn(`[download] abort failed`, abortErr);
        }
        reject(err);
      };

      const succeed = () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve();
      };

      // Two separate deadlines rather than one total budget: the server has to start
      // responding, and once it has it has to keep sending. A total timeout would kill
      // large addons on slow connections.
      const armTimeout = (ms: number, reason: string) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          fail(new Error(`Download timed out (${reason}, ${ms}ms): ${url}`));
        }, ms);
      };

      armTimeout(responseTimeoutMs, "no response");

      if (typeof options.auth?.headers === "object") {
        for (const [key, value] of Object.entries(options.auth.headers)) {
          log.info(`Setting header: ${key}=${value.substring(0, 3)}***`);
          req.setHeader(key, value);
        }
      }

      req.on("redirect", (status, method, redirectUrl) => {
        log.info(`[download] caught redirect`, status, redirectUrl);
        armTimeout(responseTimeoutMs, "no response after redirect");
        req.followRedirect();
      });

      req.on("error", (err) => {
        log.error(`[download] request failed: ${describeError(err)}`);
        fail(err);
      });

      // Without this a failed write (disk full, file locked by antivirus) surfaces as an
      // unhandled stream error instead of failing the install cleanly.
      writer.on("error", (err) => {
        log.error(`[download] write failed '${savePath}': ${describeError(err)}`);
        fail(err);
      });

      req.on("response", (response) => {
        const fileLength = parseInt((response.headers["content-length"] as string) ?? "0", 10);
        log.info(`[download] response ${response.statusCode}, content-length ${fileLength}`);
        armTimeout(stallTimeoutMs, "stalled");

        response.on("data", (data: Buffer) => {
          armTimeout(stallTimeoutMs, "stalled");
          writer.write(data, () => {
            size += data.length;
            const percent = fileLength <= 0 ? 0 : Math.floor((size / fileLength) * 100);
            if (percent % 5 === 0 && percentMod !== percent) {
              percentMod = percent;
              log.debug(`Write: [${percent}] ${size}`);
            }
          });
        });

        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            return fail(new Error(`Invalid response (${response.statusCode}): ${url}`));
          }

          return succeed();
        });

        response.on("error", (err: Error) => {
          log.error(`[download] response failed: ${describeError(err)}`);
          fail(err);
        });
      });

      req.end();
    });
  } catch (err) {
    log.error(`[DownloadFile] failed '${url}': ${describeError(err)}`);
    throw err;
  } finally {
    // always close stream
    writer.end();
  }

  return savePath;
}
