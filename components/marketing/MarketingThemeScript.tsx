import { MARKETING_THEME_STORAGE_KEY } from "@/lib/marketing/marketing-theme";

/**
 * Runs before paint to set html[data-marketing-theme] and avoid a light flash
 * when the user prefers dark (cookie, localStorage, or prefers-color-scheme).
 */
export default function MarketingThemeScript() {
  const code = `(function(){try{var k="${MARKETING_THEME_STORAGE_KEY}";var t=null;var m=document.cookie.match(new RegExp("(?:^|; )"+k+"=(dark|light)"));if(m)t=m[1];if(t!=="light"&&t!=="dark"){try{t=localStorage.getItem(k)}catch(e){}}if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-marketing-theme",t)}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
