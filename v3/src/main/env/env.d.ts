/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MAIN_VITE_BUILD_FLAVOR: string
  readonly VITE_WOWUP_HUB_URL: string
  readonly VITE_TUKUI_URL: string
  readonly VITE_CURSEFORGE_API_KEY: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
