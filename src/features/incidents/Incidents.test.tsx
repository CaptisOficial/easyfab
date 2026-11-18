// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Incidents } from "./Incidents";
import { incidentsOverview, saveIncident, type IncidentsOverview } from "../../lib/api";
import { I18nProvider, useI18n } from "../../lib/i18n";

let reqCounter = 1;
vi.mock("../../lib/api", () => ({
  incidentsOverview: vi.fn(),
  saveIncident: vi.fn(),
  requestId: () => `req-${reqCounter++}`,
}));

function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div>
      <span data-testid="active-lang">{lang}</span>
      <button type="button" onClick={() => setLang(lang === "es" ? "en" : "es")}>
        toggle-lang
      </button>
    </div>
  );
}

function makeOverview(): IncidentsOverview {
  return {
    catalogs: {
      version: 1,
      machines: [
        { id: "m1", name: "Prensa hidráulica 1 | Hydraulic press 1", active: true },
        { id: "m2", name: "Cortadora láser", active: true },
      ],
      lines: [],
      failure_types: [
        { id: "f1", name: "Falla eléctrica | Electrical fault", active: true },
        { id: "f2", name: "Desgaste mecánico", active: true },
      ],
    },
    records: [
      {
        issue_id: "rec-1",
        can_correct: true,
        leaves: [
          {
            id: "leaf-1",
            issue_id: "rec-1",
            recorded_at: "2026-10-28T10:00:00Z",
            author_id: "sup1",
            reported_by: "Supervisor Uno",
            supersedes: [],
            issue: {
              part_number: "PN-100 | PN-100 EN",
              description: "Paro de prensa | Press stoppage",
              machine_station: "m1",
              occurrence_date: "2026-10-28",
              target_due_date: "2026-10-30",
              downtime_hours: 2.5,
              scrap_pieces: 12,
              impact_level: "Línea 1 | Line 1",
              status: "In Progress",
              root_cause_containment: "Sensor dañado | Damaged sensor",
              failure_type_id: "f1",
            },
          },
        ],
        history: [
          {
            id: "hist-1",
            issue_id: "rec-1",
            recorded_at: "2026-10-28T09:00:00Z",
            author_id: "sup1",
            reported_by: "Supervisor Uno",
            supersedes: [],
            issue: {
              part_number: "PN-100 | PN-100 EN",
              description: "Paro inicial | Initial stoppage",
              machine_station: "m1",
              occurrence_date: "2026-10-28",
              target_due_date: "2026-10-30",
              downtime_hours: 1,
              scrap_pieces: 4,
              impact_level: "Línea 1 | Line 1",
              status: "Open",
              root_cause_containment: "Revisión | Inspection",
              failure_type_id: "f1",
            },
          },
          {
            id: "leaf-1",
            issue_id: "rec-1",
            recorded_at: "2026-10-28T10:00:00Z",
            author_id: "sup1",
            reported_by: "Supervisor Uno",
            supersedes: ["hist-1"],
            issue: {
              part_number: "PN-100 | PN-100 EN",
              description: "Paro de prensa | Press stoppage",
              machine_station: "m1",
              occurrence_date: "2026-10-28",
              target_due_date: "2026-10-30",
              downtime_hours: 2.5,
              scrap_pieces: 12,
              impact_level: "Línea 1 | Line 1",
              status: "In Progress",
              root_cause_containment: "Sensor dañado | Damaged sensor",
              failure_type_id: "f1",
            },
          },
        ],
      },
      {
        issue_id: "rec-2",
        can_correct: true,
        leaves: [
          {
            id: "leaf-2a",
            issue_id: "rec-2",
            recorded_at: "2026-10-29T08:00:00Z",
            author_id: "eng1",
            reported_by: "Ingeniero A",
            supersedes: [],
            issue: {
              part_number: "PN-200",
              description: "Fuga sin traducción",
              machine_station: "m2",
              occurrence_date: "2026-10-29",
              target_due_date: "",
              downtime_hours: 1.5,
              scrap_pieces: 3,
              impact_level: "Área B",
              status: "Open",
              root_cause_containment: "Sello flojo",
              failure_type_id: "f2",
            },
          },
          {
            id: "leaf-2b",
            issue_id: "rec-2",
            recorded_at: "2026-10-29T08:30:00Z",
            author_id: "eng2",
            reported_by: "Ingeniero B",
            supersedes: [],
            issue: {
              part_number: "PN-200",
              description: "Fuga alterna | Alternate leak",
              machine_station: "m1",
              occurrence_date: "2026-10-29",
              target_due_date: "",
              downtime_hours: 2,
              scrap_pieces: 5,
              impact_level: "Área B",
              status: "Contained",
              root_cause_containment: "Válvula | Valve",
              failure_type_id: "f1",
            },
          },
        ],
        history: [],
      },
    ],
    legacy: [
      { id: "LEG-1", description: "Falla anterior | Legacy fault", status: "Resolved" },
    ],
  };
}

function renderWithI18n() {
  return render(
    <I18nProvider>
      <LangToggle />
      <Incidents />
    </I18nProvider>,
  );
}

describe("Incidents", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(incidentsOverview).mockReset();
    vi.mocked(saveIncident).mockReset();
    reqCounter = 1;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders default Spanish UI, picked read fields, and ResultsModal closeLabel", async () => {
    vi.mocked(incidentsOverview).mockResolvedValue(makeOverview());
    renderWithI18n();

    expect(await screen.findByText("Paro de prensa")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Problemas de línea" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Actualizar incidencias" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "+ Nueva incidencia" })).toBeTruthy();
    expect(screen.getByText("Prensa hidráulica 1 · En atención")).toBeTruthy();
    expect(screen.getByText("Paro: 2.5 h · Scrap: 12 piezas")).toBeTruthy();
    expect(screen.getByText("Sensor dañado")).toBeTruthy();
    expect(screen.getByText("Hay 2 versiones concurrentes. Integra una corrección con todas las versiones.")).toBeTruthy();
    expect(screen.getByText("Fuga sin traducción")).toBeTruthy();
    expect(screen.getByText("Cortadora láser · Abierta")).toBeTruthy();
    expect(screen.getByText("Historial (2 eventos)")).toBeTruthy();
    expect(screen.getByText("Registro anterior · consulta")).toBeTruthy();
    expect(screen.getByText("Falla anterior")).toBeTruthy();
    expect(screen.getByText("Resuelta")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "+ Nueva incidencia" }));
    expect(screen.getByRole("heading", { name: "Registrar incidencia" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cerrar registrar incidencia" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Prensa hidráulica 1" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Falla eléctrica" })).toBeTruthy();
    expect(screen.getByLabelText("Fecha compromiso")).toBeTruthy();
  });

  it("switches to English and falls back to Spanish via pick() when separator is absent", async () => {
    vi.mocked(incidentsOverview).mockResolvedValue(makeOverview());
    renderWithI18n();
    await screen.findByText("Paro de prensa");

    fireEvent.click(screen.getByRole("button", { name: "toggle-lang" }));
    expect(screen.getByTestId("active-lang").textContent).toBe("en");

    expect(screen.getByRole("region", { name: "Line issues" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh incidents" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "+ New incident" })).toBeTruthy();
    expect(screen.getByText("Press stoppage")).toBeTruthy();
    expect(screen.getByText("Hydraulic press 1 · In progress")).toBeTruthy();
    expect(screen.getByText("Downtime: 2.5 h · Scrap: 12 pieces")).toBeTruthy();
    expect(screen.getByText("Damaged sensor")).toBeTruthy();
    expect(screen.getByText("There are 2 concurrent versions. Merge a correction with all versions.")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Merge from this version" })).toHaveLength(2);
    expect(screen.getByText("History (2 events)")).toBeTruthy();
    expect(screen.getByText("Legacy record · read-only")).toBeTruthy();
    expect(screen.getByText("Legacy fault")).toBeTruthy();
    expect(screen.getByText("Resolved")).toBeTruthy();

    // Monolingual Spanish records fall back to Spanish in English mode
    expect(screen.getByText("Fuga sin traducción")).toBeTruthy();
    expect(screen.getByText("Cortadora láser · Open")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "+ New incident" }));
    expect(screen.getByRole("heading", { name: "Register incident" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close register incident" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Hydraulic press 1" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Cortadora láser" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Electrical fault" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Desgaste mecánico" })).toBeTruthy();
  });

  it("preserves full 'Español | Inglés' strings on create and correction saves in English mode", async () => {
    const initial = makeOverview();
    vi.mocked(incidentsOverview).mockResolvedValue(initial);
    vi.mocked(saveIncident).mockResolvedValue(initial);

    window.localStorage.setItem("easyfab.lang", "en");
    renderWithI18n();
    await screen.findByText("Press stoppage");

    // 1. Create incident in English mode
    fireEvent.click(screen.getByRole("button", { name: "+ New incident" }));
    fireEvent.change(screen.getByLabelText("Part or component number"), { target: { value: "Parte A | Part A" } });
    fireEvent.change(screen.getByLabelText("Problem description"), { target: { value: "Falla nueva | New fault" } });
    fireEvent.change(screen.getByLabelText("Machine / station"), { target: { value: "m1" } });
    fireEvent.change(screen.getByLabelText("Failure type"), { target: { value: "f1" } });
    fireEvent.change(screen.getByLabelText("Occurrence date"), { target: { value: "2026-10-30" } });
    fireEvent.change(screen.getByLabelText("Commitment date"), { target: { value: "2026-11-02" } });
    fireEvent.change(screen.getByLabelText("Downtime (hours)"), { target: { value: "1.5" } });
    fireEvent.change(screen.getByLabelText("Scrap (pieces)"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Impact / affected area"), { target: { value: "Alto | High" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Contained" } });
    fireEvent.change(screen.getByLabelText("Root cause & containment"), { target: { value: "Ajuste | Adjustment" } });
    fireEvent.click(screen.getByRole("button", { name: "Save incident" }));

    await screen.findByText("Incident saved. History preserved.");
    const createPayload = vi.mocked(saveIncident).mock.calls[0][0];
    expect(createPayload.issue_id).toBeNull();
    expect(createPayload.issue).toEqual({
      part_number: "Parte A | Part A",
      description: "Falla nueva | New fault",
      machine_station: "m1",
      occurrence_date: "2026-10-30",
      target_due_date: "2026-11-02",
      downtime_hours: 1.5,
      scrap_pieces: 6,
      impact_level: "Alto | High",
      status: "Contained",
      root_cause_containment: "Ajuste | Adjustment",
      failure_type_id: "f1",
    });

    // 2. Correct existing incident in English mode: inputs must keep full "Español | Inglés"
    fireEvent.click(screen.getByRole("button", { name: "Correct or follow up" }));
    expect(screen.getByRole("heading", { name: "Correct incident" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close correct incident" })).toBeTruthy();
    expect(screen.getByText("Editing a correction; the previous event is preserved.")).toBeTruthy();

    expect((screen.getByLabelText("Part or component number") as HTMLInputElement).value).toBe("PN-100 | PN-100 EN");
    expect((screen.getByLabelText("Problem description") as HTMLInputElement).value).toBe("Paro de prensa | Press stoppage");
    expect((screen.getByLabelText("Impact / affected area") as HTMLInputElement).value).toBe("Línea 1 | Line 1");
    expect((screen.getByLabelText("Root cause & containment") as HTMLInputElement).value).toBe("Sensor dañado | Damaged sensor");

    fireEvent.change(screen.getByLabelText("Problem description"), { target: { value: "Paro de prensa v2 | Press stoppage v2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save incident" }));

    await waitFor(() => expect(saveIncident).toHaveBeenCalledTimes(2));
    const correctPayload = vi.mocked(saveIncident).mock.calls[1][0];
    expect(correctPayload.issue_id).toBe("rec-1");
    expect(correctPayload.supersedes).toEqual(["leaf-1"]);
    expect(correctPayload.issue.part_number).toBe("PN-100 | PN-100 EN");
    expect(correctPayload.issue.description).toBe("Paro de prensa v2 | Press stoppage v2");
    expect(correctPayload.issue.impact_level).toBe("Línea 1 | Line 1");
    expect(correctPayload.issue.root_cause_containment).toBe("Sensor dañado | Damaged sensor");
  });

  it("translates backend load and save errors via tError() and updates reactively on toggle", async () => {
    vi.mocked(incidentsOverview).mockRejectedValueOnce("No se pudo leer el archivo: C:\\Data\\issues.json");
    window.localStorage.setItem("easyfab.lang", "en");
    const view = renderWithI18n();

    const loadAlert = await screen.findByRole("alert");
    expect(loadAlert.textContent).toBe("Could not read file: C:\\Data\\issues.json");

    fireEvent.click(screen.getByRole("button", { name: "toggle-lang" }));
    expect(screen.getByRole("alert").textContent).toBe("No se pudo leer el archivo: C:\\Data\\issues.json");

    view.unmount();

    const overview = makeOverview();
    vi.mocked(incidentsOverview).mockResolvedValue(overview);
    vi.mocked(saveIncident).mockRejectedValue("La incidencia cambió. Actualiza e integra todas las versiones antes de corregir.");
    window.localStorage.setItem("easyfab.lang", "es");
    renderWithI18n();

    await screen.findByText("Paro de prensa");
    fireEvent.click(screen.getByRole("button", { name: "+ Nueva incidencia" }));
    fireEvent.change(screen.getByLabelText("Número de parte o componente"), { target: { value: "PN-9" } });
    fireEvent.change(screen.getByLabelText("Descripción del problema"), { target: { value: "Prueba" } });
    fireEvent.change(screen.getByLabelText("Equipo / estación"), { target: { value: "m1" } });
    fireEvent.change(screen.getByLabelText("Fecha de ocurrencia"), { target: { value: "2026-10-30" } });
    fireEvent.change(screen.getByLabelText("Impacto / área afectada"), { target: { value: "Alto" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar incidencia" }));

    expect(await screen.findByText("La incidencia cambió. Actualiza e integra todas las versiones antes de corregir.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "toggle-lang" }));
    expect(screen.getByText("The incident changed. Refresh and reconcile all versions before correcting.")).toBeTruthy();
  });

  it("shows empty state and disables save when no active machines exist", async () => {
    vi.mocked(incidentsOverview).mockResolvedValue({
      records: [],
      legacy: [],
      catalogs: { version: 1, machines: [{ id: "m-off", name: "Inactiva", active: false }], lines: [], failure_types: [] },
    });
    window.localStorage.setItem("easyfab.lang", "en");
    renderWithI18n();

    expect(await screen.findByText("No incidents recorded.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "+ New incident" }));
    expect(screen.getByText("Admin must register at least one active machine in Settings → FAB Catalogs.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save incident" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
