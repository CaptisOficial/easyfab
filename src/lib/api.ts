import { invoke, isTauri } from "@tauri-apps/api/core";

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
  lead_engineer_id: string;
  start_date: string;
  target_date: string;
}
export interface Project extends NewProject {
  id: string;
  status: "Not Started" | "In Progress" | "Completed" | "On Hold";
}
export interface ProjectsOverview {
  projects: Project[];
  leads: { id: string; name: string }[];
  can_create: boolean;
  write_message: string;
}
export const projectsOverview = () => invoke<ProjectsOverview>("projects_overview");
export const createProject = (input: NewProject) => invoke<Project>("create_project", { input });
