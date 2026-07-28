import { AscensionAddonProvider, AscensionCatalogAddon } from '../../addon-providers';
import { AddonFolder } from '../../addons';
import { createMockWowInstallation } from '../../mocks/mock-wow-installation';
import { WowInstallation } from '../../models';
import { AddonChannelType, WowClientType } from '../../types';
import { Toc } from '../../toc';
import { NetworkInterface, PostConfig } from '../../utils';

const CATALOG_URL = 'https://api.example.test/v1/ascension';
const WEBSITE_URL = 'https://example.test/ascension';

const addon: AscensionCatalogAddon = {
  id: 'ascension-ui',
  name: 'Ascension UI',
  author: 'Ascension Community',
  summary: 'A community UI.',
  description: 'A complete UI for Ascension.',
  thumbnailUrl: 'https://cdn.example.test/ascension-ui.png',
  downloads: 42,
  releasedAt: '2026-07-01T00:00:00.000Z',
  releases: [
    {
      id: 'release-1',
      version: '1.0.0',
      channel: 'stable',
      folders: ['AscensionUI'],
      downloadUrl: 'https://cdn.example.test/ascension-ui-1.0.0.zip',
      releasedAt: '2026-07-01T00:00:00.000Z',
      changelog: 'Initial release.',
    },
  ],
};

class CatalogNetworkInterface implements NetworkInterface {
  public urls: string[] = [];

  public async getJson<T>(url: string | URL): Promise<T> {
    const value = url.toString();
    this.urls.push(value);

    if (value.endsWith('/addons/ascension-ui')) {
      return addon as T;
    }
    if (value.startsWith(`${CATALOG_URL}/addons`)) {
      return [addon] as T;
    }
    throw new Error(`Unexpected URL: ${value}`);
  }

  public async postJson<T>(_url: string | URL, _config: PostConfig): Promise<T> {
    throw new Error(`Unexpected POST: ${_url.toString()} ${JSON.stringify(_config)}`);
  }

  public async getText(_url: string | URL): Promise<string> {
    throw new Error(`Unexpected text request: ${_url.toString()}`);
  }
}

function createProvider(network = new CatalogNetworkInterface()): AscensionAddonProvider {
  return new AscensionAddonProvider(CATALOG_URL, WEBSITE_URL, network);
}

function createWotlkInstallation(): WowInstallation {
  return { ...createMockWowInstallation(), clientType: WowClientType.Ascension };
}

test('AscensionAddonProvider searches and maps WoTLK catalog addons', async () => {
  const network = new CatalogNetworkInterface();
  const results = await createProvider(network).searchByQuery('ui', createWotlkInstallation());

  expect(network.urls).toEqual([`${CATALOG_URL}/addons?query=ui`]);
  expect(results).toHaveLength(1);
  expect(results[0]).toMatchObject({
    externalId: 'ascension-ui',
    externalUrl: `${WEBSITE_URL}/addons/ascension-ui`,
    name: 'Ascension UI',
    providerName: 'Ascension',
  });
  expect(results[0].files?.[0]).toMatchObject({
    channelType: AddonChannelType.Stable,
    downloadUrl: 'https://cdn.example.test/ascension-ui-1.0.0.zip',
    externalId: 'release-1',
    gameVersion: '3.3.5',
  });
});

test('AscensionAddonProvider does not query non-WoTLK installations', async () => {
  const network = new CatalogNetworkInterface();
  const results = await createProvider(network).searchByQuery('ui', createMockWowInstallation());

  expect(results).toEqual([]);
  expect(network.urls).toEqual([]);
});

test('AscensionAddonProvider lists all catalog addons in the initial view', async () => {
  const network = new CatalogNetworkInterface();
  const results = await createProvider(network).getFeaturedAddons(createWotlkInstallation());

  expect(results).toHaveLength(1);
  expect(network.urls).toEqual([`${CATALOG_URL}/addons`]);
});

test('AscensionAddonProvider reports missing and invalid addons during sync', async () => {
  const results = await createProvider().getAll(createWotlkInstallation(), ['ascension-ui', '']);

  expect(results.searchResults).toHaveLength(1);
  expect(results.errors).toHaveLength(1);
  expect(results.errors[0].message).toBe('invalid addon id found: ');
});

test('AscensionAddonProvider reads metadata from the addon detail endpoint', async () => {
  const provider = createProvider();
  const installation = createWotlkInstallation();

  await expect(provider.getDescription(installation, 'ascension-ui')).resolves.toBe('A complete UI for Ascension.');
  await expect(provider.getChangelog(installation, 'ascension-ui', 'release-1')).resolves.toBe('Initial release.');
});

test('AscensionAddonProvider scans only folders with an explicit catalog ID', async () => {
  const provider = createProvider();
  const toc: Toc = {
    dependencyList: [],
    fileName: 'AscensionUI.toc',
    filePath: '/Interface/AddOns/AscensionUI/AscensionUI.toc',
    interface: ['30300'],
    version: '1.0.0',
  };
  const addonFolder: AddonFolder = {
    name: 'AscensionUI',
    path: '/Interface/AddOns/AscensionUI',
    status: '',
    tocs: [toc],
  };

  await provider.scan(createWotlkInstallation(), AddonChannelType.Stable, [addonFolder]);
  expect(addonFolder.matchingAddon).toBeUndefined();

  toc.ascensionAddonId = 'ascension-ui';
  await provider.scan(createWotlkInstallation(), AddonChannelType.Stable, [addonFolder]);

  expect(provider.allowReScan).toBe(true);
  expect(addonFolder.matchingAddon).toMatchObject({
    externalId: 'ascension-ui',
    installationId: 'test-install',
    installedAt: expect.any(Date),
    installedFolderList: ['AscensionUI'],
    installedVersion: '1.0.0',
    providerName: 'Ascension',
    releasedAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  });
});
