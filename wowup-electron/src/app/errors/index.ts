export * from "./install-error";
import { CustomError } from "ts-custom-error";

export class ClassicAssetMissingError extends CustomError {
  public constructor(message?: string) {
    super(message);
  }
}

export class AssetMissingError extends CustomError {
  public constructor(message?: string) {
    super(message);
  }
}

export class NoReleaseFoundError extends CustomError {
  public constructor(message?: string) {
    super(message);
  }
}
