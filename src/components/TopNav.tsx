import { useEffect, useState, type ReactNode, type Ref } from "react";
import { LogOut } from "lucide-react";
import type { SessionUser } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { KawasakiLogo } from "./branding/KawasakiLogo";

interface Props {
  settings: ReactNode;
  pageTitle?: string;
  headingRef?: Ref<HTMLHeadingElement>;
  user: SessionUser | null;
  logoutDisabled: boolean;
  onLogout: () => void;
}
export function TopNav({ settings, user, logoutDisabled, onLogout, pageTitle, headingRef }: Props) {
  const { lang, setLang, t, formatDate } = useI18n();
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const roleLabel = user ? t(`role.${user.role}` as const) : "";

  return <header className="sticky top-0 z-40 flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-kmx-lime bg-kmx-carbon px-4 py-2 text-white">
    <nav aria-label={t("nav.appMenu")}>{settings}</nav>
    <KawasakiLogo className="h-8 w-auto" theme="dark" />
    <div aria-hidden="true" className="h-6 w-px bg-kmx-border-dark" />
    <h1 className="text-sm font-extrabold uppercase tracking-wider">Easy<span className="text-kmx-lime">FAB</span></h1>
    {pageTitle && <h2 ref={headingRef} tabIndex={-1} className="min-w-0 border-l border-kmx-border-dark pl-4 text-sm font-bold outline-none" aria-live="polite">{pageTitle}</h2>}
    <time dateTime={today.toISOString()} className="ml-auto whitespace-nowrap text-xs text-kmx-gray-300">{formatDate(today)}</time>
    <button
      type="button"
      onClick={() => setLang(lang === "es" ? "en" : "es")}
      aria-label={t("prefs.language")}
      title={t("prefs.language")}
      className="rounded-sm border border-kmx-border-dark px-2 py-1 text-xs font-bold uppercase text-kmx-gray-300 hover:border-kmx-lime hover:text-kmx-lime focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kmx-lime"
    >
      {lang === "es" ? "ES" : "EN"}
    </button>
    {user && <div className="flex min-w-0 items-center gap-3 border-l border-kmx-border-dark pl-4">
      <div className="min-w-0"><p className="max-w-52 truncate text-sm font-bold" title={user.name}>{user.name}</p>
        <p className="text-xs text-kmx-gray-300">{roleLabel}</p></div>
      <button type="button" title={t("nav.logoutTitle")} aria-label={t("nav.logoutTitle")} disabled={logoutDisabled} onClick={onLogout}
        className="flex h-10 items-center gap-2 rounded-sm border border-kmx-border-dark px-3 text-sm hover:border-kmx-lime hover:text-kmx-lime focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kmx-lime disabled:opacity-50">
        <LogOut size={19} aria-hidden="true" /><span className="hidden md:inline">{t("nav.logout")}</span>
      </button>
    </div>}
  </header>;
}
