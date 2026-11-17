// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Projects } from "./Projects";
import * as api from "../../lib/api";
import * as resultsApi from "../../lib/results-api";
vi.mock("../../lib/results-api", () => ({ saveResultsCommitment: vi.fn(), resultsDetail: vi.fn(), saveResultsActivity: vi.fn(), saveResultsBlocker: vi.fn(), requestActivityRevision: vi.fn(), reviewResultsDeliverable: vi.fn(), setResultsClosure: vi.fn(), resolveResultsConflict: vi.fn(), attachResultsEvidence: vi.fn(), readResultsEvidence: vi.fn() }));
vi.mock("../../lib/api", () => ({ projectsOverview: vi.fn(), createProject: vi.fn(), projectDetail: vi.fn(), plantCatalogs: vi.fn(), reorderProjects: vi.fn() }));
afterEach(cleanup);
const overview: api.ProjectsOverview = { projects: [], leads: [{ id: "eng", name: "Engineer Test" }], can_create: true, write_message: "Registro disponible" };
const project: api.Project = { id: "PRJ-test", wbs: "FAB-1", name: "Fixture project", process_area: "FAB", engineer_ids: ["eng"], start_date: "2026-10-28", target_date: "2026-11-30", status: "Not Started" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.projectsOverview).mockResolvedValue(overview);
  vi.mocked(api.plantCatalogs).mockResolvedValue({
    config: { version: 1, lines: [{ id: "line-fab", name: "FAB", active: true }, { id: "line-chassis", name: "Chasis", active: false }], machines: [], failure_types: [] },
    revision: "rev-1",
    can_edit: false,
  });
});
function fillDoD() {
  fireEvent.change(screen.getByLabelText("Resultado esperado y alcance"), { target: { value: "Station ready" } });
  fireEvent.change(screen.getByLabelText("Nombre del entregable 1"), { target: { value: "Validated equipment" } });
  fireEvent.change(screen.getByLabelText("Fecha del entregable 1"), { target: { value: "2026-11-01" } });
  fireEvent.change(screen.getByLabelText("Criterio 1.1"), { target: { value: "Capacity verified" } });
}
it("muestra carga, vacío, guarda una sola vez y vuelve a consultar al montar", async () => {
  const user = userEvent.setup();
  let finish!: (p: api.Project) => void;
  vi.mocked(api.createProject).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<Projects />);
  expect(screen.getByText("Cargando proyectos…")).toBeTruthy();
  await screen.findByText("No hay proyectos registrados.");
  // Open the creation modal
  await user.click(screen.getByRole("button", { name: "Nuevo proyecto" }));
  await user.type(screen.getByLabelText("Título del proyecto"), "Fixture project");
  await user.selectOptions(screen.getByLabelText("Área de proceso"), "FAB");
  await user.click(screen.getByLabelText("Engineer Test · eng"));
  fireEvent.change(screen.getByLabelText("Fecha de inicio"), { target: { value: "2026-10-28" } });
  fireEvent.change(screen.getByLabelText("Fecha objetivo"), { target: { value: "2026-11-30" } });
  fillDoD();
  await user.click(screen.getByRole("button", { name: "Guardar proyecto" }));
  fireEvent.submit(screen.getByRole("button", { name: "Guardando…" }).closest("form")!);
  expect(api.createProject).toHaveBeenCalledTimes(1);
  // Backend generates WBS, so we only assert the other fields are passed.
  expect(api.createProject).toHaveBeenCalledWith({ wbs: "", name: project.name, process_area: project.process_area, engineer_ids: project.engineer_ids, start_date: project.start_date, target_date: project.target_date });
  finish(project);
  await screen.findByText("Proyecto guardado con condiciones de cierre.");
  // The generated WBS will appear in the UI; we only check that name appears.
  expect(screen.getByText(/Fixture project/)).toBeTruthy();
  view.unmount();
  vi.mocked(api.projectsOverview).mockResolvedValue({ ...overview, projects: [project] });
  render(<Projects />);
  await screen.findByLabelText("Fecha de referencia");
  fireEvent.change(screen.getByLabelText("Fecha de referencia"), { target: { value: "2026-10-29" } });
  await screen.findByText("FAB-1 · Fixture project");
  expect(api.projectsOverview).toHaveBeenCalledTimes(2);
});
it("presenta error de lectura y permite reintentar", async () => {
  vi.mocked(api.projectsOverview).mockRejectedValueOnce("Archivo corrupto");
  render(<Projects />);
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Archivo corrupto");
  await userEvent.click(screen.getByRole("button", { name: "Actualizar proyectos" }));
  await screen.findByText("No hay proyectos registrados.");
});
it("muestra solo consulta cuando Rust no autoriza registrar", async () => {
  vi.mocked(api.projectsOverview).mockResolvedValue({ ...overview, can_create: false, write_message: "Alta bloqueada" });
  render(<Projects />);
  await screen.findByText("Alta bloqueada");
  expect(screen.queryByLabelText("Código WBS")).toBeNull();
  expect(screen.queryByRole("button", { name: "Guardar proyecto" })).toBeNull();
  expect(api.createProject).not.toHaveBeenCalled();
});
it("conserva captura y muestra rechazo de guardado sin anunciar éxito", async () => {
  vi.mocked(api.createProject).mockRejectedValue("Fecha inválida");
  render(<Projects />);
  await screen.findByText("No hay proyectos registrados.");
  // Open the creation modal before attempting to change fields
  await userEvent.click(screen.getByRole("button", { name: "Nuevo proyecto" }));
  fireEvent.change(screen.getByLabelText("Título del proyecto"), { target: { value: "Conservar" } });
  await userEvent.click(screen.getByLabelText("Engineer Test · eng"));
  fillDoD();
  fireEvent.submit(screen.getByRole("button", { name: "Guardar proyecto" }).closest("form")!);
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Fecha inválida"));
  expect((screen.getByLabelText("Título del proyecto") as HTMLInputElement).value).toBe("Conservar");
  expect(screen.queryByText(/guardado\./)).toBeNull();
});

it("exige al menos un ingeniero y guarda varias asignaciones sin elegir responsable principal", async () => {
  vi.mocked(api.projectsOverview).mockResolvedValue({ ...overview, leads: [...overview.leads, { id: "eng2", name: "Second Engineer" }] });
  vi.mocked(api.createProject).mockResolvedValue({ ...project, engineer_ids: ["eng", "eng2"] });
  render(<Projects />);
  await userEvent.click(await screen.findByRole("button", { name: "Nuevo proyecto" }));
  const form = screen.getByRole("button", { name: "Guardar proyecto" }).closest("form")!;
  fireEvent.submit(form);
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Selecciona al menos un ingeniero responsable.");
  expect(api.createProject).not.toHaveBeenCalled();
  await userEvent.click(screen.getByLabelText("Engineer Test · eng"));
  await userEvent.click(screen.getByLabelText("Second Engineer · eng2"));
  fillDoD();
  fireEvent.submit(form);
  await screen.findByText("Proyecto guardado con condiciones de cierre.");
  expect(api.createProject).toHaveBeenCalledWith(expect.objectContaining({ engineer_ids: ["eng", "eng2"] }));
  expect(screen.getByRole("cell", { name: "Engineer Test, Second Engineer" })).toBeTruthy();
});

it("filtra el cronograma por periodo, cambia escala y vuelve a hoy", async () => {
  vi.mocked(api.projectsOverview).mockResolvedValue({ ...overview, projects: [project] });
  render(<Projects />);
  await screen.findByLabelText("Fecha de referencia");
  fireEvent.change(screen.getByLabelText("Fecha de referencia"), { target: { value: "2026-10-29" } });
  expect(screen.getByRole("button", { name: "Semana" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("table")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Mes" }));
  expect(screen.getByText(/2026-10-01 — 2026-10-31/)).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Año" }));
  expect(screen.getByText(/2026-01-01 — 2026-12-31/)).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Periodo siguiente" }));
  expect(screen.getByText("No hay proyectos planificados en este periodo.")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Periodo anterior" }));
  expect(screen.getByText("FAB-1 · Fixture project")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Hoy" }));
  expect((screen.getByLabelText("Fecha de referencia") as HTMLInputElement).value).toBeTruthy();
});

it("permite cerrar el diálogo de alta y recuperar el borrador al reabrir", async () => {
  render(<Projects />);
  await screen.findByText("No hay proyectos registrados.");
  await userEvent.click(screen.getByRole("button", { name: "Nuevo proyecto" }));
  const dialog = screen.getByRole("dialog", { name: "Registrar proyecto" });
  expect(dialog.parentElement?.parentElement).toBe(document.body);
  fireEvent.change(screen.getByLabelText("Título del proyecto"), { target: { value: "Borrador conservado" } });
  await userEvent.click(screen.getByRole("button", { name: "Cerrar registro de proyecto" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Nuevo proyecto" }));
  expect((screen.getByLabelText("Título del proyecto") as HTMLInputElement).value).toBe("Borrador conservado");
});

it("recarga el cronograma al cerrar el trabajo para mostrar el proyecto iniciado", async () => {
  vi.mocked(api.projectsOverview).mockResolvedValue({ ...overview, projects: [project] });
  vi.mocked(resultsApi.resultsDetail).mockResolvedValue({ project, commitment: null, baseline: null, activities: [], blockers: [], reviews: [], closure: null, capabilities: { can_plan_activities: false, can_change_commitment: false, can_review_deliverables: false, can_resolve_blockers: false }, history: [], conflicts: [], plan_issues: [], legacy_entries: [] });
  render(<Projects />);
  await screen.findByLabelText("Fecha de referencia");
  fireEvent.change(screen.getByLabelText("Fecha de referencia"), { target: { value: "2026-10-29" } });
  await userEvent.click(screen.getByRole("button", { name: "FAB-1 · Fixture project" }));
  await screen.findByText("Definir el resultado antes de planear");
  vi.mocked(api.projectsOverview).mockResolvedValue({ ...overview, projects: [{ ...project, status: "In Progress" }] });
  await userEvent.click(screen.getByRole("button", { name: "Cerrar detalle del proyecto" }));
  await screen.findByText("En curso", { selector: ".schedule-status" });
  expect(api.projectsOverview).toHaveBeenCalledTimes(2);
});

it("exige condiciones de cierre y reintenta activación sin duplicar el proyecto registrado", async () => {
  vi.mocked(api.createProject).mockResolvedValue(project);
  vi.mocked(resultsApi.saveResultsCommitment).mockRejectedValueOnce("No se pudo publicar la definición").mockResolvedValueOnce({} as resultsApi.ResultsDetail);
  render(<Projects />);
  await userEvent.click(await screen.findByRole("button", { name: "Nuevo proyecto" }));
  await userEvent.click(screen.getByLabelText("Engineer Test · eng"));
  fireEvent.submit(screen.getByRole("button", { name: "Guardar proyecto" }).closest("form")!);
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Define el resultado esperado y alcance del proyecto.");
  expect(api.createProject).not.toHaveBeenCalled();
  fillDoD();
  fireEvent.change(screen.getByLabelText("Título del proyecto"), { target: { value: project.name } });
  fireEvent.change(screen.getByLabelText("Área de proceso"), { target: { value: "FAB" } });
  fireEvent.change(screen.getByLabelText("Fecha de inicio"), { target: { value: project.start_date } });
  fireEvent.change(screen.getByLabelText("Fecha objetivo"), { target: { value: project.target_date } });
  fireEvent.submit(screen.getByRole("button", { name: "Guardar proyecto" }).closest("form")!);
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "No se pudo publicar la definición");
  expect(screen.getByText(/El proyecto ya se registró/)).toBeTruthy();
  fireEvent.submit(screen.getByRole("button", { name: "Reintentar definición de cierre" }).closest("form")!);
  await screen.findByText("Proyecto guardado con condiciones de cierre.");
  expect(api.createProject).toHaveBeenCalledTimes(1);
  expect(resultsApi.saveResultsCommitment).toHaveBeenCalledTimes(2);
  expect(resultsApi.saveResultsCommitment).toHaveBeenLastCalledWith(expect.objectContaining({ project_id: project.id, expected_revision: null, commitment: expect.objectContaining({ final_outcome: "Station ready" }) }));
});

it("vincula Área de proceso con las líneas activas del catálogo de planta", async () => {
  render(<Projects />);
  await userEvent.click(await screen.findByRole("button", { name: "Nuevo proyecto" }));
  const select = screen.getByLabelText("Área de proceso") as HTMLSelectElement;
  expect(select).toBeTruthy();
  expect(screen.getByRole("option", { name: "FAB" })).toBeTruthy();
  expect(screen.queryByRole("option", { name: "Chasis" })).toBeNull();
});

it("simplifica el registro unificando objetivo global y subactividades con entregables embebidos", async () => {
  vi.mocked(api.createProject).mockResolvedValue(project);
  vi.mocked(resultsApi.saveResultsCommitment).mockResolvedValue({} as resultsApi.ResultsDetail);
  vi.mocked(resultsApi.saveResultsActivity).mockResolvedValue({} as resultsApi.ResultsDetail);

  render(<Projects />);
  await userEvent.click(await screen.findByRole("button", { name: "Nuevo proyecto" }));

  // Verificamos que existen exactamente 2 secciones de planeación ágil
  expect(screen.getByText("Datos generales y objetivo del proyecto")).toBeTruthy();
  expect(screen.getByText("Subactividades y entregables de cierre (Sprints / Historias)")).toBeTruthy();
  expect(screen.queryByText("Definición de cierre · DoD (Definition of Done)")).toBeNull();

  // El objetivo engloba los alcances
  expect(screen.getByLabelText("Resultado esperado y alcance")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Título del proyecto"), { target: { value: "Nuevo proyecto ágil" } });
  fireEvent.change(screen.getByLabelText("Resultado esperado y alcance"), { target: { value: "Automatizar línea de soldadura y transferir a producción" } });
  fireEvent.change(screen.getByLabelText("Área de proceso"), { target: { value: "FAB" } });
  await userEvent.click(screen.getByLabelText("Engineer Test · eng"));
  fireEvent.change(screen.getByLabelText("Fecha de inicio"), { target: { value: "2026-11-01" } });
  fireEvent.change(screen.getByLabelText("Fecha objetivo"), { target: { value: "2026-11-30" } });

  // Subactividad / Entregable 1 con criterio embebido
  fireEvent.change(screen.getByLabelText("Nombre del entregable 1"), { target: { value: "Sprint 1: Instalación de celdas" } });
  fireEvent.change(screen.getByLabelText("Fecha del entregable 1"), { target: { value: "2026-11-15" } });
  fireEvent.change(screen.getByLabelText("Criterio 1.1"), { target: { value: "Celdas fijadas y calibradas" } });

  fireEvent.submit(screen.getByRole("button", { name: "Guardar proyecto" }).closest("form")!);
  await screen.findByText("Proyecto guardado con condiciones de cierre.");

  expect(resultsApi.saveResultsCommitment).toHaveBeenCalledWith(
    expect.objectContaining({
      commitment: expect.objectContaining({
        final_outcome: "Automatizar línea de soldadura y transferir a producción",
        scope: "Automatizar línea de soldadura y transferir a producción",
        deliverables: [
          expect.objectContaining({
            title: "Sprint 1: Instalación de celdas",
            due_date: "2026-11-15",
            criteria: [
              expect.objectContaining({
                description: "Celdas fijadas y calibradas",
                evidence_required: true,
              }),
            ],
          }),
        ],
      }),
    })
  );
  expect(resultsApi.saveResultsActivity).toHaveBeenCalledWith(
    expect.objectContaining({
      activity: expect.objectContaining({
        title: "Sprint 1: Instalación de celdas",
        forecast_start: "2026-11-01",
        forecast_due: "2026-11-15",
        responsible_id: "eng",
      }),
    })
  );
});

it("muestra la prioridad activa y permite al supervisor reordenar proyectos", async () => {
  const p1: api.Project = { ...project, id: "PRJ-1", wbs: "FAB-01", name: "Proyecto Uno", priority: 1 };
  const p2: api.Project = { ...project, id: "PRJ-2", wbs: "FAB-02", name: "Proyecto Dos", priority: 2 };
  vi.mocked(api.projectsOverview).mockResolvedValue({ ...overview, projects: [p1, p2], can_create: true });
  vi.mocked(api.reorderProjects).mockResolvedValue({
    ...overview,
    projects: [{ ...p2, priority: 1 }, { ...p1, priority: 2 }],
    can_create: true,
  });
  render(<Projects />);
  await screen.findByLabelText("Fecha de referencia");
  fireEvent.change(screen.getByLabelText("Fecha de referencia"), { target: { value: "2026-10-29" } });

  expect(screen.getByText("#1")).toBeTruthy();
  expect(screen.getByText("#2")).toBeTruthy();

  const downBtn = screen.getByRole("button", { name: "Bajar prioridad de FAB-01" });
  await userEvent.click(downBtn);

  expect(api.reorderProjects).toHaveBeenCalledWith(["PRJ-2", "PRJ-1"]);
  await screen.findByText("Prioridad de proyectos actualizada.");
});

it("no muestra controles de reordenamiento de prioridad a no supervisores", async () => {
  const p1: api.Project = { ...project, id: "PRJ-1", wbs: "FAB-01", name: "Proyecto Uno", priority: 1 };
  vi.mocked(api.projectsOverview).mockResolvedValue({ ...overview, projects: [p1], can_create: false });
  render(<Projects />);
  await screen.findByLabelText("Fecha de referencia");
  fireEvent.change(screen.getByLabelText("Fecha de referencia"), { target: { value: "2026-10-29" } });

  expect(screen.getByText("#1")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Subir prioridad de FAB-01" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Bajar prioridad de FAB-01" })).toBeNull();
});

it("filtra proyectos por activos, en curso y completados", async () => {
  const notStarted: api.Project = { ...project, id: "PRJ-1", wbs: "FAB-01", name: "Sin iniciar Uno", status: "Not Started", priority: 1 };
  const inProgress: api.Project = { ...project, id: "PRJ-2", wbs: "FAB-02", name: "En curso Dos", status: "In Progress", priority: 2 };
  const completed: api.Project = { ...project, id: "PRJ-3", wbs: "FAB-03", name: "Completado Tres", status: "Completed", priority: 3 };
  vi.mocked(api.projectsOverview).mockResolvedValue({ ...overview, projects: [notStarted, inProgress, completed] });

  render(<Projects />);
  await screen.findByLabelText("Fecha de referencia");
  fireEvent.change(screen.getByLabelText("Fecha de referencia"), { target: { value: "2026-10-29" } });

  expect(screen.getByRole("button", { name: "Activos" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("FAB-01 · Sin iniciar Uno")).toBeTruthy();
  expect(screen.getByText("FAB-02 · En curso Dos")).toBeTruthy();
  expect(screen.queryByText("FAB-03 · Completado Tres")).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: "En curso" }));
  expect(screen.getByRole("button", { name: "En curso" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.queryByText("FAB-01 · Sin iniciar Uno")).toBeNull();
  expect(screen.getByText("FAB-02 · En curso Dos")).toBeTruthy();
  expect(screen.queryByText("FAB-03 · Completado Tres")).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: "Completados" }));
  expect(screen.getByRole("button", { name: "Completados" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.queryByText("FAB-01 · Sin iniciar Uno")).toBeNull();
  expect(screen.queryByText("FAB-02 · En curso Dos")).toBeNull();
  expect(screen.getByText("FAB-03 · Completado Tres")).toBeTruthy();
});

it("muestra estado vacío cuando no hay proyectos completados en el filtro", async () => {
  vi.mocked(api.projectsOverview).mockResolvedValue({ ...overview, projects: [project] });
  render(<Projects />);
  await screen.findByLabelText("Fecha de referencia");
  fireEvent.change(screen.getByLabelText("Fecha de referencia"), { target: { value: "2026-10-29" } });

  await userEvent.click(screen.getByRole("button", { name: "Completados" }));
  expect(screen.getByText("No hay proyectos completados.")).toBeTruthy();
});

it("respeta el responsable elegido por fila cuando se asignan varios ingenieros al proyecto", async () => {
  const user = userEvent.setup();
  vi.mocked(api.projectsOverview).mockResolvedValue({
    ...overview,
    leads: [...overview.leads, { id: "eng2", name: "Second Engineer" }],
  });
  vi.mocked(api.createProject).mockResolvedValue({ ...project, engineer_ids: ["eng", "eng2"] });

  render(<Projects />);
  await user.click(await screen.findByRole("button", { name: "Nuevo proyecto" }));
  await user.type(screen.getByLabelText("Título del proyecto"), "Asignación directa");
  await user.selectOptions(screen.getByLabelText("Área de proceso"), "FAB");
  await user.click(screen.getByLabelText("Engineer Test · eng"));
  await user.click(screen.getByLabelText("Second Engineer · eng2"));
  fireEvent.change(screen.getByLabelText("Fecha de inicio"), { target: { value: "2026-10-28" } });
  fireEvent.change(screen.getByLabelText("Fecha objetivo"), { target: { value: "2026-11-30" } });
  fillDoD();
  await user.selectOptions(screen.getByLabelText("Responsable 1"), "eng2");

  await user.click(screen.getByRole("button", { name: "Guardar proyecto" }));
  await screen.findByText("Proyecto guardado con condiciones de cierre.");

  expect(resultsApi.saveResultsActivity).toHaveBeenCalledWith(
    expect.objectContaining({
      activity: expect.objectContaining({ responsible_id: "eng2" }),
    }),
  );
});
