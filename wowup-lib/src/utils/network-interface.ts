export interface PostConfig {
  body: unknown;
  headers?: {
    [header: string]: string | string[];
  };
  timeoutMs?: number;
  cache?: boolean;
}

export interface GetConfig {
  headers?: {
    [header: string]: string | string[];
  };
  timeoutMs?: number;
}

export interface NetworkInterface {
  getJson<T>(url: URL | string, config?: GetConfig): Promise<T>;
  
  getText(url: URL | string, config?: GetConfig): Promise<string>;

  postJson<T>(url: URL | string, config: PostConfig): Promise<T>;
}
