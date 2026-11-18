import { useEffect, useState } from "react";
import { listUsers, setUserActive, type DirectoryUser } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { NewUserForm } from "./NewUserForm";
import { RecoveryForm } from "./RecoveryForm";

type DirectoryNotice = {
  key: "auth.directory.activatedNotice" | "auth.directory.deactivatedNotice";
  name: string;
} | null;

export function UserDirectory() {
  const { t, tError } = useI18n();
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [confirmation, setConfirmation] = useState("");
  const [temporary, setTemporary] = useState("");
  const [notice, setNotice] = useState<DirectoryNotice>(null);

  async function refresh() { setUsers(await listUsers()); }
  useEffect(() => {
    let active = true;
    listUsers().then(items => { if (active) setUsers(items); })
      .catch(e => { if (active) setError(e); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function changeStatus(user: DirectoryUser) {
    setBusy(true); setError(null); setTemporary(""); setNotice(null);
    try {
      const active = user.status === "inactive";
      setTemporary(await setUserActive(user.id, active) ?? "");
      setNotice({
        key: active ? "auth.directory.activatedNotice" : "auth.directory.deactivatedNotice",
        name: user.name,
      });
      setConfirmation("");
      await refresh();
    } catch (e) { setError(e); }
    finally { setBusy(false); }
  }

  const errorText = error !== null && error !== "" ? tError(error) : "";
  const noticeText = notice ? t(notice.key, { name: notice.name }) : "";

  return <section className="space-y-4 border-t pt-4" aria-labelledby="directory-title">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="directory-title" className="font-bold">{t("auth.directory.title")}</h2>
      <div className="ml-auto"><NewUserForm onCreated={refresh} /></div>
    </div>
    {busy && <p role="status">{t("auth.directory.loading")}</p>}
    {errorText && <p role="alert" className="text-kmx-red">{errorText}</p>}
    {noticeText && <p role="status">{noticeText}</p>}
    {temporary && <div><p>{t("auth.directory.tempValid")}</p><output className="font-mono">{temporary}</output>
      <button type="button" onClick={() => setTemporary("")} className="ml-3 border px-3 py-1">{t("common.hideTemporary")}</button></div>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <caption className="sr-only">{t("auth.directory.caption")}</caption>
      <thead><tr>{([
        ["nameId", t("auth.directory.colNameId")],
        ["role", t("auth.role")],
        ["status", t("common.status")],
        ["action", t("common.action")],
        ["recovery", t("auth.directory.colRecovery")],
      ] as const).map(([key, label]) => <th key={key} scope="col" className="p-2">{label}</th>)}</tr></thead>
      <tbody>{users.map(user => <tr key={user.id} className="border-t">
        <th scope="row" className="p-2 font-normal">{user.name}<span className="block text-xs">{user.id}</span></th>
        <td className="p-2">{t(`role.${user.role}` as const)}</td>
        <td className="p-2">{user.status === "active" ? t("common.active") : t("common.inactive")}</td>
        <td className="p-2">{user.role === "admin" ? t("auth.directory.protectedAccount") : confirmation === user.id
          ? <><p>{t("auth.directory.confirmDeactivate", { name: user.name })}</p><button disabled={busy} onClick={() => changeStatus(user)} className="border p-1">{t("common.confirm")}</button>
            <button disabled={busy} onClick={() => setConfirmation("")} className="ml-2 border p-1">{t("common.cancel")}</button></>
          : <button disabled={busy} className="border p-1" onClick={() => user.status === "active" ? setConfirmation(user.id) : changeStatus(user)}>
            {user.status === "active" ? t("common.deactivate") : t("auth.directory.activateAndTemp")}</button>}
        </td>
        <td className="p-2">{user.status === "active" ? <RecoveryForm user={user} /> : t("auth.directory.requiresReactivation")}</td>
      </tr>)}</tbody>
    </table></div>
    <p className="text-sm">{t("auth.directory.footerHelp")}</p>
  </section>;
}
