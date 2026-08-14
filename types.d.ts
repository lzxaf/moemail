/// <reference types="@cloudflare/workers-types" />


declare global {
  interface CloudflareEnv {
    DB: D1Database;
    SITE_CONFIG: KVNamespace;
  }

  interface Window {
    turnstile?: {
      render: (element: HTMLElement | string, options: Record<string, unknown>) => string
      reset: (widgetId?: string) => void
      remove: (widgetId: string) => void
    }
  }

  type Env = CloudflareEnv
}

declare module "next-auth" {
  interface User {
    roles?: { name: string }[]
    username?: string | null
    providers?: string[]
    passwordVersion?: string
  }

  interface Session {
    user: User
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    username?: string | null
    passwordVersion?: string
  }
}

export type { Env }
