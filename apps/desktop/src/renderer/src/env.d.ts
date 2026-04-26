/// <reference types="vite/client" />

interface Window {
  api: {
    getLocalIP: () => Promise<string>;
    getVersion: () => Promise<string>;
    restartSignaling: (port: number) => Promise<number>;
    virtualCam: {
      check: () => Promise<VCamInfo>;
      arm: () => void;
      disarm: () => void;
      sendFrame: (buffer: ArrayBuffer, width: number, height: number) => void;
      onStatus: (cb: (status: string, reason: string) => void) => void;
      offStatus: () => void;
    };
    updater: {
      onDownloaded: (cb: (version: string) => void) => void;
      install: () => void;
    };
  };
}
