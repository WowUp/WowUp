// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses `index.ts`, but if you do
// `ng build --env=prod` then `index.prod.ts` will be used instead.
// The list of which env maps to which file can be found in `.angular-cli.json`.

export const AppConfig = {
  production: false,
  environment: "DEV",
  wowUpApiUrl: "https://api.dev.wowup.io",
  wowUpHubUrl: "https://hub.dev.wowup.io",
  googleAnalyticsId: "UA-92563227-4",
  wowupRepositoryUrl: "https://github.com/WowUp/WowUp",
  warcraftTavernNewsFeedUrl: "https://www.warcrafttavern.com/?call_custom_simple_rss=1&csrp_post_type=wow-classic-news,tbc-classic-news,retail-news&csrp_thumbnail_size=large",
  azure: {
    applicationInsightsKey: "4a53e8d9-796c-4f80-b1a6-9a058374dd6d",
  },
  autoUpdateIntervalMs: 3600000, // 1 hour
  appUpdateIntervalMs: 3600000, // 1 hour
  defaultHttpTimeoutMs: 10000,
  defaultHttpResetTimeoutMs: 30000,
  wowUpHubHttpTimeoutMs: 10000,
};
