/// <reference types="vite/client" />

interface Window {
  api: {
    getLocalIP: () => Promise<string>
  }
}
