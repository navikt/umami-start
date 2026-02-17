/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

interface ImportMetaEnv {
  VITE_APP_TITLE: string
  VITE_APP_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
