/// <reference types="vite/client" />

interface Window {
  api: {
    getLocalIP: () => Promise<string>;
    getVersion: () => Promise<string>;
    restartSignaling: (port: number) => Promise<number>;
    virtualCam: {
      check: () => Promise<any>;
      recheck: () => Promise<any>;
      arm: () => void;
      disarm: () => void;
      sendFrame: (buffer: ArrayBuffer, width: number, height: number) => void;
      onStatus: (cb: (status: string, reason: string) => void) => void;
      offStatus: () => void;
    };
    virtualMic: {
      check: () => Promise<any>;
      recheck: () => Promise<any>;
      arm: () => void;
      disarm: () => void;
      sendAudio: (buffer: ArrayBuffer) => void;
      onStatus: (cb: (status: string, reason: string) => void) => void;
      offStatus: () => void;
    };
    updater: {
      onDownloaded: (cb: (version: string) => void) => void;
      onAvailable: (cb: (version: string) => void) => void;
      install: () => void;
      openReleases: () => void;
    };
  };
}
