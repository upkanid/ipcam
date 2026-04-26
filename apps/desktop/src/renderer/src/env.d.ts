/// <reference types="vite/client" />

interface Window {
  api: {
    getLocalIP: () => Promise<string>;
    restartSignaling: (port: number) => Promise<number>;
    virtualCam: {
      check: () => Promise<VCamInfo>;
      arm: () => void;
      disarm: () => void;
      sendFrame: (buffer: ArrayBuffer, width: number, height: number) => void;
      onStatus: (cb: (status: string, reason: string) => void) => void;
      offStatus: () => void;
    };
  };
}
