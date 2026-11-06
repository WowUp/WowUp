import { NetworkInterface, PostConfig } from '../utils';

export function createMockNetworkInterface(): MockNetworkInterface {
  return new MockNetworkInterface();
}

export class MockNetworkInterface implements NetworkInterface {
  public async getJson<T>(url: string | URL): Promise<T> {
    // console.log('[GET] ' + url);
    const res = await fetch(url.toString(), {});
    if (res.status < 200 || res.status > 299) {
      throw new Error(`invalid response: ${res.status}, ${res.statusText}`);
    }
    return await res.json();
  }

  public async postJson<T>(url: string | URL, config: PostConfig): Promise<T> {
    // console.log('[POST] ' + url);
    const res = await fetch(url.toString(), {
      method: 'POST',
      body: JSON.stringify(config.body),
    });
    if (res.status < 200 || res.status > 299) {
      console.error('Bad response', config.body);
      throw new Error('invalid response: ' + res.status);
    }
    return await res.json();
  }

  public async getText(url: string | URL): Promise<string> {
    const res = await fetch(url.toString(), {});
    if (res.status < 200 || res.status > 299) {
      throw new Error(`invalid response: ${res.status}, ${res.statusText}`);
    }
    return await res.text();
  }
}
