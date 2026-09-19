export const THEME_OPTIONS = [
  { id: "light", label: "settings.themeLight" },
  { id: "dark", label: "settings.themeDark" },
  { id: "mist", label: "settings.themeMist" },
  { id: "rose", label: "settings.themeRose" },
  { id: "pine", label: "settings.themePine" },
  { id: "auto", label: "settings.themeSystem" },
] as const;

export type ThemePreference = (typeof THEME_OPTIONS)[number]["id"];
export type ResolvedTheme = Exclude<ThemePreference, "auto">;

export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_OPTIONS.some((option) => option.id === value);
}

export function isDarkTheme(theme: ResolvedTheme): boolean {
  return theme === "dark" || theme === "pine";
}

// Apply the saved palette before first paint, including when storage is blocked.
// The second IIFE applies the saved (or browser-inferred) locale and sets
// `lang`/`dir` before first paint so Persian renders RTL without a flash.
export const THEME_INIT_SCRIPT = `(function(){var t="auto";try{var s=localStorage.getItem("pi-theme");if(${JSON.stringify(THEME_OPTIONS.map((option) => option.id))}.includes(s))t=s}catch(e){}if(t==="auto")t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var r=document.documentElement;r.dataset.theme=t;r.classList.toggle("dark",t==="dark"||t==="pine")})();(function(){var l=null;try{var s2=localStorage.getItem("pi-locale");if(["en","zh-CN","zh-TW","fa"].includes(s2))l=s2}catch(e){}if(!l){var nav=window.navigator;var langs=(nav&&nav.languages&&nav.languages.length?nav.languages:nav&&nav.language?[nav.language]:[]);for(var i=0;i<langs.length;i++){var n=String(langs[i]||"").toLowerCase();if(n==="en"||n.indexOf("en-")===0){l="en";break}if(n==="zh"||n==="zh-cn"||n.indexOf("zh-cn-")===0||n==="zh-sg"||n.indexOf("zh-sg-")===0||n==="zh-hans"||n.indexOf("zh-hans-")===0){l="zh-CN";break}if(n==="zh-tw"||n.indexOf("zh-tw-")===0||n==="zh-hk"||n.indexOf("zh-hk-")===0||n==="zh-mo"||n.indexOf("zh-mo-")===0||n==="zh-hant"||n.indexOf("zh-hant-")===0){l="zh-TW";break}if(n.indexOf("zh-")===0){l="zh-CN";break}if(n==="fa"||n.indexOf("fa-")===0){l="fa";break}}}if(!l)l="en";var r2=document.documentElement;r2.lang=l;r2.dir=l==="fa"?"rtl":"ltr"})();`;
