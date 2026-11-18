let pendingOpenUrls: string[] = [];

/** On a cold start on mac, open-url fires before the renderer is loaded, so hold the urls until it asks */
export function setPendingOpenUrl(...openUrls: string[]): void {
  pendingOpenUrls = openUrls;
}

/** Hands the held urls out once; later calls get none */
export function takePendingOpenUrls(): string[] {
  const urls = pendingOpenUrls;
  pendingOpenUrls = [];
  return urls;
}
