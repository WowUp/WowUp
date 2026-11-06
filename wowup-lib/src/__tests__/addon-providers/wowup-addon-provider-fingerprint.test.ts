import { WowUpAddonProvider } from '../../addon-providers/wowup-addon-provider';
import { GetAddonsByFingerprintResponse } from '../../models/wowup';
import { NetworkInterface } from '../../utils';

function createProvider(response: Partial<GetAddonsByFingerprintResponse>) {
  const network = {
    getJson: jest.fn(),
    getText: jest.fn(),
    postJson: jest.fn().mockResolvedValue(response),
  };
  const provider = new WowUpAddonProvider('https://hub.test', 'https://site.test', network as NetworkInterface);
  return { provider, network };
}

function exactMatch(id: number, fingerprints: string[]) {
  return {
    id,
    matched_release: {
      addonFolders: fingerprints.map((fingerprint, i) => ({ id: i, folder_name: `F${i}`, fingerprint })),
    },
  } as any;
}

test('getAddonIdsByFingerprints maps each known fingerprint to its hub addon id', async () => {
  const { provider, network } = createProvider({
    exactMatches: [exactMatch(50, ['aaa']), exactMatch(77, ['bbb', 'not-asked'])],
  });

  const ids = await provider.getAddonIdsByFingerprints(['aaa', 'bbb', 'ccc', 'aaa']);

  expect(network.postJson).toHaveBeenCalledWith('https://hub.test/addons/fingerprint', {
    body: { fingerprints: ['aaa', 'bbb', 'ccc'] },
  });
  expect(Array.from(ids.entries())).toEqual([
    ['aaa', '50'],
    ['bbb', '77'],
  ]);
});

test('getAddonIdsByFingerprints keeps the first match when a fingerprint is shared', async () => {
  const { provider } = createProvider({ exactMatches: [exactMatch(1, ['aaa']), exactMatch(2, ['aaa'])] });

  const ids = await provider.getAddonIdsByFingerprints(['aaa']);

  expect(ids.get('aaa')).toEqual('1');
});

test('getAddonIdsByFingerprints skips the request when there is nothing to look up', async () => {
  const { provider, network } = createProvider({ exactMatches: [] });

  const ids = await provider.getAddonIdsByFingerprints(['', '']);

  expect(network.postJson).not.toHaveBeenCalled();
  expect(ids.size).toEqual(0);
});

test('getAddonIdsByFingerprints tolerates releases without folders', async () => {
  const { provider } = createProvider({ exactMatches: [{ id: 3 } as any] });

  const ids = await provider.getAddonIdsByFingerprints(['aaa']);

  expect(ids.size).toEqual(0);
});
