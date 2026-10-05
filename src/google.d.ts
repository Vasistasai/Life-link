export {}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            auto_select?: boolean
          }) => void
          renderButton: (
            element: HTMLElement,
            options: {
              theme: 'outline'
              size: 'large'
              shape: 'rectangular'
              text: 'continue_with'
              width: number
              logo_alignment: 'left'
            },
          ) => void
          cancel: () => void
        }
      }
    }
  }

  interface ImportMetaEnv {
    readonly VITE_FIREBASE_API_KEY?: string
    readonly VITE_FIREBASE_DATABASE_URL?: string
    readonly VITE_GOOGLE_CLIENT_ID?: string
    readonly VITE_ADMIN_EMAIL?: string
  }
}
