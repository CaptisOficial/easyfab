import { useEffect, useState, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import type { SessionUser } from "../lib/api";
import { KawasakiLogo } from "./branding/KawasakiLogo";

const roles = { admin: "Administrador", supervisor: "Supervisor", engineer: "Ingeniero" };
const dateFormat = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Mexico_City" });
interface Props {
  settings: ReactNode;
  user: SessionUser | null;
  logoutDisabled: boolean;
  onLogout: () => void;
}
export function TopNav({ settings, user, logoutDisabled, onLogout }: Props) {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return <header className="sticky top-0 z-40 flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-kmx-lime bg-kmx-carbon px-4 py-2 text-white">
    <nav aria-label="Menú de la aplicación">{settings}</nav>
    <KawasakiLogo className="h-8 w-auto" theme="dark" />
    <div aria-hidden="true" className="h-6 w-px bg-kmx-border-dark" />
    <h1 className="text-sm font-extrabold uppercase tracking-wider">Easy<span className="text-kmx-lime">FAB</span></h1>
    <time dateTime={today.toISOString()} className="ml-auto whitespace-nowrap text-xs text-kmx-gray-300">{dateFormat.format(today)}</time>
    {user && <div className="flex min-w-0 items-center gap-3 border-l border-kmx-border-dark pl-4">
      <div className="min-w-0"><p className="max-w-52 truncate text-sm font-bold" title={user.name}>{user.name}</p>
        <p className="text-xs text-kmx-gray-300">{roles[user.role]}</p></div>
      <button type="button" title="Cerrar sesión" aria-label="Cerrar sesión" disabled={logoutDisabled} onClick={onLogout}
        className="flex h-10 items-center gap-2 rounded-sm border border-kmx-border-dark px-3 text-sm hover:border-kmx-lime hover:text-kmx-lime focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kmx-lime disabled:opacity-50">
        <LogOut size={19} aria-hidden="true" /><span className="hidden md:inline">Salir</span>
      </button>
    </div>}
  </header>;
}
