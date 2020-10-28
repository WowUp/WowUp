import { GitHubUploader } from "./github-uploader";

export interface GitHubAsset {
  url: string;
  id: number;
  node_id: string;
  name: string;
  label: string;
  uploader: GitHubUploader;
  content_type: string;
  state: string;
  size: number;
  download_count: number;
  created_at: string;
  updated_at: string;
  browser_download_url: string;
}
