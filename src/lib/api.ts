import { invoke, isTauri } from "@tauri-apps/api/core";

/** Resultado de la detección de la carpeta ENGINEERING FILES - 10.FAB. */
export interface OneDriveDetection {
  found: boolean;
  /** Raíz `ENGINEERING FILES - 10.FAB` cuando se encontró. */
  engineering_root: string | null;
  /** Carpeta de datos `Management/Data`. */
  data_dir: string | null;
  /** Origen que permitió la detección (env, registro, escaneo). */
  source: string | null;
  /** Rutas revisadas, en orden, para diagnóstico. */
  candidates_checked: string[];
}

/** Resultado del auto-bootstrap de `Management/Data`. */
export interface BootstrapReport {
  data_dir: string;
  created: string[];
  existing: string[];
}

export const runningInTauri = (): boolean => isTauri();

export async function detectOneDrivePath(): Promise<OneDriveDetection> {
  if (!runningInTauri()) {
    // Modo navegador (vite dev sin Tauri): datos de demostración, sin acceso a disco.
    return {
      found: false,
      engineering_root: null,
      data_dir: null,
      source: "browser-preview",
      candidates_checked: [],
    };
  }
  return invoke<OneDriveDetection>("detect_onedrive_path");
}

export async function bootstrapDataDir(): Promise<BootstrapReport> {
  return invoke<BootstrapReport>("bootstrap_data_dir");
}
export interface LoginChoice { id: string; name: string }
export interface SessionUser { id: string; name: string; role: "admin" | "supervisor" | "engineer"; must_change_password: boolean }
export const listLoginUsers = () => invoke<LoginChoice[]>("list_login_users");
export const login = (userId: string, pin: string) => invoke<SessionUser>("login", { userId, pin });
export const logout = () => invoke<void>("logout");

export const changePassword = (newPin: string) => invoke<void>("change_password", { newPin });
export const resetPassword = (userId: string) => invoke<string>("reset_password", { userId });
