import { CustomError } from 'ts-custom-error';
import { AddonWarningType } from '../types';

export class ErrorContainer extends CustomError {
  public readonly innerError?: Error;
  public readonly warningType?: AddonWarningType;

  public constructor(innerError?: Error, message?: string, warningType?: AddonWarningType) {
    super(message);
    this.innerError = innerError;
    this.warningType = warningType;
  }
}
