import { WowInstallation } from '../models';
import { AddonChannelType, WowClientType } from '../types';

export function createMockWowInstallation(): WowInstallation {
  return {
    clientType: WowClientType.Retail,
    defaultAddonChannelType: AddonChannelType.Stable,
    defaultAutoUpdate: false,
    displayName: 'test-client',
    id: 'test-install',
    label: 'test-client',
    location: 'nowhere',
    selected: true,
    availableUpdateCount: 0,
  };
}
