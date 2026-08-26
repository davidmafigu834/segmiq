import { MARKETING_THEME_STORAGE_KEY } from "@/lib/marketing/marketing-theme";

/**
 * Runs before paint to set html[data-marketing-theme] and avoid a theme flash.
 */
export default function MarketingThemeScript({
  fallback = "light",
}: {
  fallback?: "light" | "dark";
}) {
  const resolve =
    fallback === "dark"
      ? `"dark"`
      : `window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"`;
  const code = `(function(){try{var k="${MARKETING_THEME_STORAGE_KEY}";var t=null;var m=document.cookie.match(new RegExp("(?:^|; )"+k+"=(dark|light)"));if(m)t=m[1];if(t!=="light"&&t!=="dark"){try{t=localStorage.getItem(k)}catch(e){}}if(t!=="light"&&t!=="dark"){t=${resolve}}document.documentElement.setAttribute("data-marketing-theme",t)}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
