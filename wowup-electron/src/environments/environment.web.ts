// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses `index.ts`, but if you do
// `ng build --env=prod` then `index.prod.ts` will be used instead.
// The list of which env maps to which file can be found in `.angular-cli.json`.

export const AppConfig = {
  production: false,
  environment: "DEV",
  wowUpWebsiteUrl: "https://dev.wowup.io",
  wowUpApiUrl: "https://api.dev.wowup.io",
  wowUpHubUrl: "https://hub.dev.wowup.io",
  warcraftTavernNewsFeedUrl:
    "https://www.warcrafttavern.com/?call_custom_simple_rss=1&csrp_post_type=wow-classic-news,tbc-classic-news,retail-news&csrp_thumbnail_size=medium",
  newsRefreshIntervalMs: 3600000, // 1 hour
  featuredAddonsCacheTimeSec: 30, // 30 sec
};
