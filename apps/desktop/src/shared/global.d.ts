import type { DesktopApi } from "@desktop/shared/contracts";

declare global {
  interface Window {
    contentDesk: DesktopApi;
  }
}
