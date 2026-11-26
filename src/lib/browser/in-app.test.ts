import { describe, expect, it } from "vitest";
import { inAppBrowserName } from "./in-app";

describe("inAppBrowserName", () => {
  it("reconhece os navegadores embutidos mais comuns", () => {
    expect(inAppBrowserName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 350.0.0")).toBe("Instagram");
    expect(inAppBrowserName("Mozilla/5.0 (Linux; Android 14; wv) Chrome/120 Mobile [FB_IAB/FB4A;FBAV/450.0;]")).toBe("Facebook");
    expect(inAppBrowserName("Mozilla/5.0 (iPhone) Mobile/15E148 musical_ly_35.0 BytedanceWebview/d8a21c6")).toBe("TikTok");
  });
  it("não confunde Safari e Chrome normais", () => {
    expect(inAppBrowserName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1")).toBeNull();
    expect(inAppBrowserName("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36")).toBeNull();
  });
});
