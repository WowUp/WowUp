import { CustomError } from "ts-custom-error";

export class InstallError extends CustomError {
  public constructor(message?: string, public addonName?: string) {
    super(message);
  }
}
