import { AddonWarningType } from '../types';
import { GenericProviderError } from './generic-provider-error';

export class SourceRemovedAddonError extends GenericProviderError {
  public constructor(public addonId: string, innerError?: Error) {
    super(innerError, '', AddonWarningType.MissingOnProvider);
  }
}
