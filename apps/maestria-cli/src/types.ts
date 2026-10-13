export interface PlatformStatus {
  readonly id: string;
  readonly label: string;
  readonly available: boolean;
  readonly installed: boolean;
  readonly installedVersion: string;
  readonly latestVersion: string;
}

export interface StatusOutput {
  readonly platforms: PlatformStatus[];
}

export interface PlatformResult {
  readonly id: string;
  readonly label: string;
  readonly ok: boolean;
  readonly message: string;
  readonly prevVersion?: string;
  readonly nextVersion?: string;
  /** Legacy CLI-managed skill state left by this operation (absent when untouched). */
  readonly skills?: string[];
}
