import { invoke } from "@tauri-apps/api/core";
import type {
  EnvironmentDoctorResult,
  EnvironmentInstallPlan,
  EnvironmentInstallResult,
} from "../../types";

export async function getEnvironmentDoctor(): Promise<EnvironmentDoctorResult> {
  return invoke<EnvironmentDoctorResult>("environment_doctor");
}

export async function getEnvironmentInstallPlan(): Promise<EnvironmentInstallPlan> {
  return invoke<EnvironmentInstallPlan>("environment_install_plan");
}

export async function runEnvironmentInstaller(
  runId?: string,
): Promise<EnvironmentInstallResult> {
  return invoke<EnvironmentInstallResult>("environment_install_run", { runId });
}

export async function retryEnvironmentInstallerStep(
  stepId: string,
  runId?: string,
): Promise<EnvironmentInstallResult> {
  return invoke<EnvironmentInstallResult>("environment_install_step_retry", {
    stepId,
    runId,
  });
}
