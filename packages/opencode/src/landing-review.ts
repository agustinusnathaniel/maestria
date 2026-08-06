import { createHash } from 'node:crypto';

export type LandingReviewState =
  | 'inactive'
  | 'armed'
  | 'reviewing'
  | 'rejected'
  | 'failed'
  | 'stale'
  | 'approved';

export interface LandingReviewVerdict {
  verdict: 'approved' | 'rejected';
  artifactDigest: string;
  summary: string;
  findings: string[];
}

export interface LandingReviewRecord {
  state: LandingReviewState;
  rootSessionID: string;
  reviewerSessionID?: string;
  artifactDigest?: string;
  artifactManifest?: WorktreeContentManifest;
}

export interface WorktreeManifestEntry {
  path: string;
  contentDigest: string;
}

export interface WorktreeContentManifest {
  entries: readonly WorktreeManifestEntry[];
  digest: string;
}

const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const VERDICT_KEYS = ['artifactDigest', 'findings', 'summary', 'verdict'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function unwrapApiData(value: unknown): unknown {
  if (!isRecord(value) || !('data' in value)) return value;
  if (value.data === undefined)
    throw new Error('[maestria] OpenCode SDK returned no artifact data.');
  return value.data;
}

/** Parse exactly the JSON object requested from the reviewer. */
export function parseLandingReviewVerdict(value: unknown): LandingReviewVerdict | undefined {
  if (!isRecord(value)) return undefined;
  const keys = Object.keys(value).sort();
  if (
    keys.length !== VERDICT_KEYS.length ||
    keys.some((key, index) => key !== VERDICT_KEYS[index])
  ) {
    return undefined;
  }

  const verdict = value.verdict;
  const digest = value.artifactDigest;
  const summary = value.summary;
  const findings = value.findings;
  if (
    (verdict !== 'approved' && verdict !== 'rejected') ||
    typeof digest !== 'string' ||
    !DIGEST_PATTERN.test(digest) ||
    typeof summary !== 'string' ||
    !Array.isArray(findings) ||
    findings.some((finding) => typeof finding !== 'string')
  ) {
    return undefined;
  }

  return { verdict, artifactDigest: digest, summary, findings };
}

export interface ArtifactClient {
  session: {
    diff(options: { path: { id: string }; query?: { directory?: string } }): Promise<unknown>;
  };
}

function artifactContent(value: unknown): Array<{ file: string; content: string }> {
  if (!Array.isArray(value)) {
    throw new Error('[maestria] OpenCode returned an invalid artifact diff.');
  }

  return value
    .map((entry) => {
      if (!isRecord(entry) || typeof entry.file !== 'string' || typeof entry.after !== 'string') {
        throw new Error('[maestria] OpenCode returned an invalid artifact file record.');
      }
      return { file: entry.file, content: entry.after };
    })
    .sort((left, right) => left.file.localeCompare(right.file));
}

function createArtifactManifest(
  files: readonly { file: string; content: string }[],
): WorktreeContentManifest {
  const entries = files.map(({ file, content }) => ({
    path: file,
    contentDigest: createHash('sha256').update(content, 'utf8').digest('hex'),
  }));
  const serialized = entries
    .map((entry) => `${JSON.stringify(entry.path)}:${JSON.stringify(entry.contentDigest)}`)
    .join(',');
  return {
    entries,
    digest: createHash('sha256').update(`[${serialized}]`, 'utf8').digest('hex'),
  };
}

/** Hash current worktree file content, not Git status, index, or HEAD metadata. */
export async function computeArtifactDigest(
  client: ArtifactClient,
  rootSessionID: string,
  directory: string,
): Promise<string> {
  const diffResponse = await client.session.diff({
    path: { id: rootSessionID },
    query: { directory },
  });
  return (await computeArtifactManifestFromResponse(diffResponse)).digest;
}

async function computeArtifactManifestFromResponse(
  diffResponse: unknown,
): Promise<WorktreeContentManifest> {
  const files = artifactContent(unwrapApiData(diffResponse));
  return createArtifactManifest(files);
}

export async function computeArtifactManifest(
  client: ArtifactClient,
  rootSessionID: string,
  directory: string,
): Promise<WorktreeContentManifest> {
  const diffResponse = await client.session.diff({
    path: { id: rootSessionID },
    query: { directory },
  });
  return computeArtifactManifestFromResponse(diffResponse);
}

export class LandingReviewStateMachine {
  private readonly records = new Map<string, LandingReviewRecord>();

  reset(rootSessionID: string): void {
    this.records.set(rootSessionID, { state: 'inactive', rootSessionID });
  }

  clear(rootSessionID: string): void {
    this.records.delete(rootSessionID);
  }

  clearAll(): void {
    this.records.clear();
  }

  get(rootSessionID: string): LandingReviewRecord | undefined {
    const record = this.records.get(rootSessionID);
    return record ? { ...record } : undefined;
  }

  arm(rootSessionID: string): void {
    const record = this.require(rootSessionID);
    if (record.state !== 'inactive') {
      throw new Error('[maestria] Landing review can only be armed once per turn.');
    }
    record.state = 'armed';
  }

  claimReviewer(rootSessionID: string): void {
    const record = this.require(rootSessionID);
    if (record.state !== 'armed') {
      throw new Error(`[maestria] Landing review cannot start from state "${record.state}".`);
    }
    record.state = 'reviewing';
  }

  setArtifactDigest(rootSessionID: string, artifactDigest: string): void {
    const record = this.require(rootSessionID);
    if (record.state !== 'reviewing' || !DIGEST_PATTERN.test(artifactDigest)) {
      throw new Error('[maestria] A reviewing landing review requires a valid artifact digest.');
    }
    record.artifactDigest = artifactDigest;
  }

  setArtifactManifest(rootSessionID: string, artifactManifest: WorktreeContentManifest): void {
    const record = this.require(rootSessionID);
    if (record.state !== 'reviewing' || !artifactManifest.digest) {
      throw new Error('[maestria] A reviewing landing review requires a valid artifact manifest.');
    }
    record.artifactManifest = artifactManifest;
    record.artifactDigest = artifactManifest.digest;
  }

  bindReviewer(rootSessionID: string, reviewerSessionID: string): void {
    const record = this.require(rootSessionID);
    if (record.state !== 'reviewing' || record.reviewerSessionID || !reviewerSessionID) {
      throw new Error('[maestria] Landing review permits exactly one reviewer child.');
    }
    record.reviewerSessionID = reviewerSessionID;
  }

  complete(
    rootSessionID: string,
    reviewerSessionID: string,
    verdict: LandingReviewVerdict,
    currentArtifactDigest: string,
    currentArtifactManifest?: WorktreeContentManifest,
  ): LandingReviewState {
    const record = this.require(rootSessionID);
    if (
      record.state !== 'reviewing' ||
      record.reviewerSessionID !== reviewerSessionID ||
      !record.artifactDigest
    ) {
      throw new Error('[maestria] Landing review identity or state validation failed.');
    }

    if (
      currentArtifactDigest !== record.artifactDigest ||
      verdict.artifactDigest !== record.artifactDigest ||
      (record.artifactManifest !== undefined &&
        (currentArtifactManifest === undefined ||
          !sameWorktreeContentManifest(record.artifactManifest, currentArtifactManifest)))
    ) {
      record.state = 'stale';
      return record.state;
    }

    record.state = verdict.verdict === 'approved' ? 'approved' : 'rejected';
    return record.state;
  }

  invalidateIfChanged(
    rootSessionID: string,
    currentArtifactDigest: string,
    currentArtifactManifest?: WorktreeContentManifest,
  ): boolean {
    const record = this.require(rootSessionID);
    if (
      record.state !== 'approved' ||
      (DIGEST_PATTERN.test(currentArtifactDigest) &&
        record.artifactDigest === currentArtifactDigest &&
        (record.artifactManifest === undefined ||
          (currentArtifactManifest !== undefined &&
            sameWorktreeContentManifest(record.artifactManifest, currentArtifactManifest))))
    )
      return false;
    record.state = 'stale';
    return true;
  }

  fail(rootSessionID: string): void {
    const record = this.require(rootSessionID);
    if (record.state === 'rejected' || record.state === 'stale' || record.state === 'failed')
      return;
    record.state = 'failed';
  }

  private require(rootSessionID: string): LandingReviewRecord {
    const record = this.records.get(rootSessionID);
    if (!record) throw new Error('[maestria] Unknown root session for landing review.');
    return record;
  }
}

function sameWorktreeContentManifest(
  left: WorktreeContentManifest,
  right: WorktreeContentManifest,
): boolean {
  return (
    left.digest === right.digest &&
    left.entries.length === right.entries.length &&
    left.entries.every(
      (entry, index) =>
        entry.path === right.entries[index]?.path &&
        entry.contentDigest === right.entries[index]?.contentDigest,
    )
  );
}
