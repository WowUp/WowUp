export interface TukUiAddon {
  id: string;
  slug: string;
  author: string;
  name: string;
  url: string;
  version: string;
  changelog_url: string;
  ticket_url: string;
  git_url: string;
  patch: string[];
  last_update: string;
  web_url: string;
  donate_url: string;
  small_desc: string;
  screenshot_url: string;
  directories: string[];
}
