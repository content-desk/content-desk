import type { DesktopApi } from "./contracts";

declare global {
  interface Window {
    contentDesk: DesktopApi;
  }
}
