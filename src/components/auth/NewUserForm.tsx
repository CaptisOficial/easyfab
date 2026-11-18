import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { createUser, type NewUser } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

const emptyUser: NewUser = { id: "", name: "", role: "engineer" };

export function NewUserForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const { t, tError } = useI18n();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const sending = useRef(false);
  function close() { if (!sending.current) { setOpen(false); trigger.current?.focus(); } }
  useEffect(() => {
    if (!open) return;
    const background = trigger.current?.closest("main") ?? trigger.current?.closest("section");
    const wasInert = background?.hasAttribute("inert");
    background?.setAttribute("inert", "");
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLInputElement>("input")?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key !== "Tab") return;
      const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? []).filter(el => !el.closest("fieldset:disabled"));
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); panel.current?.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
    }
    function containFocus(event: FocusEvent) { if (event.target instanceof Node && !panel.current?.contains(event.target)) panel.current?.focus(); }
    document.addEventListener("keydown", keyboard);
    document.addEventListener("focusin", containFocus);
    return () => { if (!wasInert) background?.removeAttribute("inert"); document.body.style.overflow = overflow; document.removeEventListener("keydown", keyboard); document.removeEventListener("focusin", containFocus); trigger.current?.focus(); };
  }, [open]);
  const [input, setInput] = useState<NewUser>(emptyUser);
  const [temporary, setTemporary] = useState("");
  const [createdId, setCreatedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true;
    setBusy(true); setError(null); setTemporary("");
    try {
      setTemporary(await createUser(input));
      setCreatedId(input.id.trim());
      setInput(emptyUser);
      await onCreated();
    } catch (e) { setError(e); }
    finally { sending.current = false; setBusy(false); }
  }

  const errorText = error !== null && error !== "" ? tError(error) : "";

  return <>
    <button ref={trigger} type="button" className="btn-primary" onClick={() => setOpen(true)}>{t("auth.newUser.open")}</button>
    {open && createPortal(<div className="project-dialog-backdrop" onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="project-dialog w-full max-w-2xl bg-surface rounded shadow-lg">
        <div className="project-dialog-header"><h3 id={titleId} className="font-bold">{t("auth.newUser.title")}</h3><button type="button" disabled={busy} aria-label={t("auth.newUser.close")} onClick={close}>✕</button></div>
        <div className="project-dialog-body"><form onSubmit={submit} className="space-y-3">
    <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
      <label>{t("auth.newUser.userId")}<input required maxLength={64} pattern="[A-Za-z0-9_-]+"
        value={input.id} onChange={e => setInput({ ...input, id: e.target.value })}
        className="block w-full border p-2" /></label>
      <label>{t("auth.fullName")}<input required maxLength={100} value={input.name}
        onChange={e => setInput({ ...input, name: e.target.value })} className="block w-full border p-2" /></label>
      <label>{t("auth.role")}<select value={input.role} className="block w-full border p-2"
        onChange={e => setInput({ ...input, role: e.target.value as NewUser["role"] })}>
        <option value="engineer">{t("role.engineer")}</option><option value="supervisor">{t("role.supervisor")}</option>
      </select></label>
    </fieldset>
    <p className="text-sm">{t("auth.newUser.accessHelp")}</p>
    {errorText && <p role="alert" className="text-kmx-red">{errorText}</p>}
    <button disabled={busy} className="bg-kmx-carbon px-4 py-2 text-white">{busy ? t("common.creating") : t("auth.newUser.submit")}</button>
    {temporary && <div role="status">
      <p>{t("auth.newUser.created", { id: createdId })}</p>
      <output className="block font-mono">{temporary}</output>
      <p className="text-sm">{t("auth.newUser.deliveryHelp")}</p>
      <p className="text-sm">{t("auth.newUser.testHelp")}</p>
      <button type="button" onClick={() => setTemporary("")} className="border px-3 py-1">{t("common.hideTemporary")}</button>
    </div>}
  </form></div></div></div>, document.body)}
  </>;
}
