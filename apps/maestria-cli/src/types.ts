// ── Types ────────────────────────────────────────────
export interface PlatformInfo {
  /** Short id used in CLI args */
  readonly id: string;
  /** Human-readable label */
  readonly label: string;
  /** npm package name (if published) */
  readonly npmPackage?: string;
}

export interface PlatformStatus {
  readonly id: string;
  readonly label: string;
  /** Whether the platform's CLI tool is available on this machine */
  readonly available: boolean;
  /** Whether maestria is installed for this platform */
  readonly installed: boolean;
  /** Installed version string (empty if not installed) */
  readonly installedVersion: string;
  /** Latest version available (empty if check failed) */
  readonly latestVersion: string;
}

export interface StatusOutput {
  readonly platforms: PlatformStatus[];
}

/** Result for one platform in install/update commands */
export interface PlatformResult {
  readonly id: string;
  readonly label: string;
  readonly ok: boolean;
  readonly message: string;
  readonly prevVersion?: string;
  readonly nextVersion?: string;
}
