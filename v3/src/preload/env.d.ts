/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PRELOAD_VITE_BUILD_FLAVOR: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
