import { invoke, isTauri } from "@tauri-apps/api/core";
import type { ResultsCapabilities } from "./project-results.generated";
import type { OperationsDetail } from "./project-results-operations.generated";

export const runningInTauri = (): boolean => isTauri();

export interface WorkspaceInfo {
  id: string;
  root: string;
  path: string;
  data_dir: string;
  docs_dir: string;
  contracts_dir: string;
  software_dir: string;
  exports_dir: string;
  backups_dir: string;
  executable: string;
}
export interface WorkspaceStatus {
  phase: "unconfigured" | "ready" | "unavailable";
  candidate_root: string | null;
  workspace: WorkspaceInfo | null;
  message: string | null;
}
export async function workspaceStatus(): Promise<WorkspaceStatus> {
  if (!runningInTauri()) return { phase: "unconfigured", candidate_root: null, workspace: null, message: "Abre la aplicación de escritorio para configurar el espacio compartido." };
  return invoke<WorkspaceStatus>("workspace_status");
}
export const configureWorkspace = (root: string) => invoke<WorkspaceInfo>("configure_workspace", { root });

export interface LoginChoice { id: string; name: string }
export interface SessionUser { id: string; name: string; role: "admin" | "supervisor" | "engineer"; must_change_password: boolean }
export interface LoginDirectory { users: LoginChoice[]; requires_admin: boolean }
export const listLoginUsers = () => invoke<LoginDirectory>("list_login_users");
export const login = (userId: string, pin: string) => invoke<SessionUser>("login", { userId, pin });
export const logout = () => invoke<void>("logout");

export const changePassword = (newPin: string) => invoke<void>("change_password", { newPin });
export const resetPassword = (userId: string) => invoke<string>("reset_password", { userId });
export interface NewUser {
  id: string;
  name: string;
  role: "engineer" | "supervisor";
}
export interface DirectoryUser extends Omit<NewUser, "role"> {
  role: SessionUser["role"];
  status: "active" | "inactive";
}
export const listUsers = () => invoke<DirectoryUser[]>("list_users");
export const createUser = (input: NewUser) => invoke<string>("create_user", { input });
export const setUserActive = (userId: string, active: boolean) => invoke<string | null>("set_user_active", { userId, active });

export const provisionInitialAdmin = (id: string, name: string) => invoke<string>("provision_initial_admin", { id, name });

export interface NewProject {
  wbs: string;
  name: string;
  process_area: string;
  engineer_ids: string[];
  start_date: string;
  target_date: string;
}
export interface Project extends NewProject {
  id: string;
  target_hours?: number;
  priority?: number;
  status: "Not Started" | "In Progress" | "Completed" | "On Hold";
}
export interface ProjectsOverview {
  projects: Project[];
  leads: { id: string; name: string }[];
  can_create: boolean;
  write_message: string;
}
export const projectsOverview = () => invoke<ProjectsOverview>("projects_overview");
// Backend-derived policy; each result write revalidates session and revisions separately.
export const projectResultsCapabilities = (projectId: string) => invoke<ResultsCapabilities>("project_results_capabilities", { projectId });
export const createProject = (input: NewProject) => invoke<Project>("create_project", { input });
export const reorderProjects = (projectIds: string[]) => invoke<ProjectsOverview>("reorder_projects", { projectIds });

export interface Evidence { id: string; name: string; relative_path: string; sha256: string; size: number }
export interface Activity { id: string; project_id: string; wbs: string; task_title: string; start_date: string; due_date: string; milestone_gate: number; status: string; supervisor_approved: boolean; evidence: Evidence[]; hours_spent: number | null }
export interface ActivityInput { id: string | null; expected_revision: string | null; project_id: string; wbs: string; task_title: string; start_date: string; due_date: string; milestone_gate: number; at_risk: boolean; hours_spent: number | null }
export interface Decision { id: string; accepted: boolean; comment: string; recorded_at: string; supervisor_id: string }
export interface ActivityEntry { owner_id: string; owner_name: string; revision: string; activity: Activity; decision: Decision | null }
export interface ProjectDetail { project: Project; entries: ActivityEntry[]; can_edit: boolean; can_review: boolean; declared_progress: number | null; engineer_progress: { engineer_id: string; engineer_name: string; progress: number | null }[]; hours_spent: number | null }
export const projectDetail = (projectId: string) => invoke<ProjectDetail>("project_detail", { projectId });
export const setProjectProgress = (input: { project_id: string; progress: number; expected_progress: number | null }) => invoke<ProjectDetail>("set_project_progress", { input });
export const setProjectTarget = (input: { project_id: string; target_hours: number; expected_target_hours: number | null }) => invoke<Project>("set_project_target", { input });
export const saveActivity = (input: ActivityInput) => invoke<ProjectDetail>("save_activity", { input });
export const attachEvidence = (input: { project_id: string; activity_id: string; revision: string; name: string; bytes: number[] }) => invoke<ProjectDetail>("attach_evidence", { input });
export const readEvidence = (projectId: string, ownerId: string, activityId: string, evidenceId: string) => invoke<number[]>("read_evidence", { projectId, ownerId, activityId, evidenceId });
export const reviewActivity = (input: { project_id: string; owner_id: string; activity_id: string; revision: string; accepted: boolean; comment: string }) => invoke<ProjectDetail>("review_activity", { input });

export function requestId(): string { return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join(""); }
export interface CatalogItem { id: string; name: string; active: boolean; line_id?: string }
export interface PlantConfig { version: number; machines: CatalogItem[]; lines: CatalogItem[]; failure_types: CatalogItem[] }
export interface PlantCatalogs { config: PlantConfig; revision: string; can_edit: boolean }
export const plantCatalogs = () => invoke<PlantCatalogs>("plant_catalogs");
export const savePlantCatalogs = (input: { config: PlantConfig; expected_revision: string }) => invoke<PlantCatalogs>("save_plant_catalogs", { input });
export interface Issue { part_number: string; description: string; machine_station: string; occurrence_date: string; target_due_date: string; downtime_hours: number; scrap_pieces: number; impact_level: string; status: "Open" | "In Progress" | "Contained" | "Resolved"; root_cause_containment: string; failure_type_id: string | null }
export interface IncidentEvent { id: string; issue_id: string; supersedes: string[]; reported_by: string; author_id: string; recorded_at: string; issue: Issue }
export interface IncidentRecord { issue_id: string; leaves: IncidentEvent[]; history: IncidentEvent[]; can_correct: boolean }
export interface IncidentsOverview { records: IncidentRecord[]; legacy: Record<string, unknown>[]; catalogs: PlantConfig }
export interface IncidentInput { request_id: string; issue_id: string | null; supersedes: string[]; issue: Issue }
export const incidentsOverview = () => invoke<IncidentsOverview>("incidents_overview");
export const saveIncident = (input: IncidentInput) => invoke<IncidentsOverview>("save_incident", { input });
export interface UserPreferences { version: number; workspace_id: string; user_id: string; theme: "light" | "dark" | "system"; ui_scale: "standard" | "large" }
export interface PreferencesView { preferences: UserPreferences; revision: string | null; warning: string | null }
export const userPreferences = () => invoke<PreferencesView>("user_preferences");
export const saveUserPreferences = (input: { theme: UserPreferences["theme"]; ui_scale: UserPreferences["ui_scale"]; expected_revision: string | null }) => invoke<PreferencesView>("save_user_preferences", { input });
export const resetUserPreferences = () => invoke<PreferencesView>("reset_user_preferences");
export interface WeeklySnapshot { generated_at: string; reporting_date: string; prepared_by: string; projects: ProjectDetail[]; result_projects: OperationsDetail[]; incidents: IncidentsOverview }
export const weeklySnapshot = (reportingDate: string) => invoke<WeeklySnapshot>("weekly_snapshot", { reportingDate });
export const exportWeekly = (reportingDate: string) => invoke<{ path: string; sha256: string }>("export_weekly", { reportingDate });
