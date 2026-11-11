// Shared by the renderer and the main process, so nothing here may depend on Angular or Electron.

/**
 * Accepts n semver (10.0.0) and formats it as an interface version (100000)
 * if the format is invalid or missing throw error
 */
export function toInterfaceVersion(version: string): string {
  if (!version) {
    throw new Error("interface version empty or undefined");
  }

  if (version.indexOf(".") === -1) {
    return version;
  }

  const parts = version.split(".");
  if (parts.length != 3) {
    console.warn(`invalid part length: ${parts.length} - ${version}`);
    while (parts.length < 3) {
      parts.push("0");
    }
    console.warn(`guessing version: ${parts.join(".")}`);
  }

  const paddedParts = parts.map((part, idx) => padInterfacePart(part, idx));

  return paddedParts.join("");
}

function padInterfacePart(part: string, idx: number) {
  const num = parseInt(part, 10);
  if (idx === 0) {
    return num;
  }
  return num >= 10 ? num : `0${num}`;
}

/** "12.1.5", "12.1.5.70688" or the interface number "120105" as a comparable number (120105), undefined if neither. */
export function toInterfaceNumber(version: string | undefined): number | undefined {
  const trimmed = (version ?? "").trim();
  if (!/^\d+(\.\d+){0,3}$/.test(trimmed)) {
    return undefined;
  }

  const parts = trimmed.split(".");
  if (parts.length === 1 && trimmed.length < 5) {
    return undefined;
  }

  const versionParts = parts.slice(0, 3);
  while (parts.length > 1 && versionParts.length < 3) {
    versionParts.push("0");
  }

  const interfaceNumber = Number(toInterfaceVersion(versionParts.join(".")));
  return Number.isFinite(interfaceNumber) ? interfaceNumber : undefined;
}

/** The readable game versions a provider file targets; tags like "Retail" that some providers list are dropped. */
export function getFileTargetVersions(file: { gameVersion?: string; gameVersions?: string[] }): string[] {
  const versions = file.gameVersions?.length ? file.gameVersions : [file.gameVersion];
  return versions.filter((version): version is string => toInterfaceNumber(version) !== undefined);
}
