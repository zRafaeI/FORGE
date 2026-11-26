/** Navegador embutido de apps (Instagram, Facebook, TikTok…), que costuma apagar o login ao fechar. */
export function inAppBrowserName(ua: string): string | null {
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return "Facebook";
  if (/TikTok|musical_ly|BytedanceWebview|trill/i.test(ua)) return "TikTok";
  if (/\bLine\//i.test(ua)) return "LINE";
  if (/Snapchat/i.test(ua)) return "Snapchat";
  if (/LinkedInApp/i.test(ua)) return "LinkedIn";
  return null;
}
