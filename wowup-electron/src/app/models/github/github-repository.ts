import { GitHubUploader } from "./github-uploader";

export interface GitHubRepository {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  private: boolean;
  owner: GitHubUploader;
  html_url: string;
  description: string;
  fork: boolean;
  url: string;
}
