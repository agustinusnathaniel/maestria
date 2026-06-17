---
name: infra-deployment-patterns
description: Infrastructure, CI/CD, deployment, Docker, and monorepo patterns for production systems.
---

# infra-deployment-patterns

Infrastructure, CI/CD, deployment, Docker, and monorepo patterns for production systems.

## Monitoring & Observability

- **Structured Logging**: Output JSON logs to stdout (never to files in containers). Use `pino` or `bunyan` for structured logging with `level`, `time`, `msg`, `reqId` fields. Add `NODE_ENV=production` to disable pretty-print in prod. Ship logs via the container runtime's log driver (CloudWatch, Loki, GCP Logging).
- **Health Checks**: Expose `GET /health` endpoint returning `{ status: "ok", version, uptime }`. Add a `/ready` endpoint that checks database connectivity and critical downstream dependencies. Configure Docker `HEALTHCHECK` and Kubernetes `livenessProbe` / `readinessProbe`.
- **Metrics**: Export Prometheus-formatted metrics at `GET /metrics`. Track request rate, error rate, latency (p50/p95/p99), and active connections. Use `opentelemetry-js` for automatic instrumentation of HTTP, gRPC, and database calls. Scrape every 15s in production.

## Database Patterns

- **Connection Pooling**: Always use a connection pool (pgBouncer for Postgres, `max` option in Prisma/Drizzle). Pool size formula: `(core_count * 2) + effective_spindle_count`. Set pool timeout at 10s. Never connect without a pool in serverless (each invocation creates a new connection).
- **Migration Strategy**: Run migrations as a separate CI step or init container, not in the app startup. Use `prisma migrate deploy` (not `prisma migrate dev` which resets data). Lock the migration table to prevent concurrent migrations in multi-replica deployments.
- **Backup & Restore**: Automated daily backups with 7-day retention (Postgres: `pg_dump` to S3/GCS). Test restore in a staging environment monthly. Document the restore procedure with expected RTO/RPO in the runbook.

## Rate Limiting & DoS Protection

- **Application-Level Rate Limiting**: Use `@upstash/ratelimit` with Redis for distributed rate limiting. Apply per route: `10 req/s` for API, `1 req/s` for auth endpoints, `5 req/min` for password reset. Return `Retry-After` header on rate-limit hits. Log rate-limit events for abuse monitoring.
- **Cloudflare WAF**: Enable WAF with OWASP Core Rule Set at the edge. Rate limit by IP with a 10 req/s burst limit before traffic hits origin. Block common exploit patterns (SQLi, XSS, path traversal) at the edge.
- **CORS**: Restrict `Access-Control-Allow-Origin` to known domains. Never use `*` in production. Validate the `Origin` header server-side (don't trust the browser). Return `Vary: Origin` to let CDNs cache per origin.

## Docker Patterns

- **Single Volume Persistence**: Mount one volume at the home directory instead of multiple specialized volumes. Use an init script that checks for a sentinel file on the volume; if absent, it copies build-time contents (SSH keys, configs, data) from staging directories to the volume. This avoids complex multi-volume setups and survives container rebuilds.
- **Multi-stage Builds**: Builder stage installs all dependencies and compiles. Runner stage is distroless (`gcr.io/distroless/nodejs`) or Alpine-based slim. Copy only the compiled output and production dependencies (use `npm ci --production` or `pnpm deploy`). Never copy `node_modules` — it includes dev dependencies and native build artifacts.
- **Docker Compose for Dev**: Mount source as a volume for hot reload. Use `docker compose watch` for file sync (replaces the older `docker compose up --build` loop). Separate services for each concern (app, postgres, redis, mailpit). Use a `.env` file for local overrides but keep the compose file itself env-agnostic.

## CI/CD (GitHub Actions)

- **Cache Ordering**: Cache restore MUST precede install steps. `actions/cache` called after `playwright install` never restores (the browser install already happened). Use `if: steps.*.outputs.cache-hit != 'true'` to skip install when cache hits. Set `restore-keys` for partial cache fallback.
- **Parallel Jobs**: Split monolithic CI into parallel jobs (lint, typecheck, test, build, e2e). Total wall time = slowest job, not sum of all. Fail fast — independent jobs don't block each other. Use `needs:` for dependencies (deploy needs build, but lint can run concurrently).
- **Timeout Guards**: Every CI job needs `timeout-minutes`. A hanging Playwright install can burn through billing minutes. Set 5-10 for lint/typecheck, 10-15 for test/build, 15-20 for e2e. Never omit — the default is 360 minutes.
- **Matrix Testing**: Run tests across multiple Node versions OR OS matrix, not both (4x explosion of jobs). Use `include` for specific version/OS pairs, not the full cartesian product. Example: `matrix: { node: [18, 20, 22], os: [ubuntu-latest] }` is already 3 jobs; adding 3 OS values makes 9.
- **pnpm Cache**: Set `cache: pnpm` in `pnpm/action-setup` (v2+). Use `cache-dependency-path: pnpm-lock.yaml` in `actions/setup-node`. Verify cache key includes the lockfile hash to invalidate on dependency changes.

## Monorepo Patterns

- **pnpm Catalog**: `catalog:` protocol in `pnpm-workspace.yaml` centralizes versions across all packages. One source of truth — update the catalog entry once, and every package using `catalog:react` picks it up. Use `catalog:` for runtime deps and `catalog:devDependencies` for tooling.
- **Circular Dependency Detection**: Use `madge --circular src/` to detect circular imports. Run in CI (fails the build). Circular deps often hide in type-only imports (TypeScript allows them, but bundlers produce runtime cycles). Use `--extensions ts,tsx` for TypeScript projects.
- **TypeScript Project References**: Enable `composite: true` in each package's `tsconfig.json`. Use the top-level `references` array to define build order. Run `pnpm -r --stream exec tsc --build` for parallel type checking. This enables incremental builds (only rebuild changed packages).
- **Workspace Package Boundaries**: Each package has a clear public API (`index.ts` barrel export). Internal modules go in `src/internal/` or `src/private/`. Write tests only against the public API — never import from internal paths directly. Use `package.json` `"exports"` field to enforce this.

## Cloudflare (Pages)

- **Wrangler Config**: Pages projects need `pages_build_output_dir` in `wrangler.toml`. The Workers-style `[build]` section with `command` and `publish` fields does NOT work for Pages — it silently fails or uses wrong defaults. Use the Pages-specific dashboard or `wrangler pages` CLI.
- **Build Command**: Configure the build command in the Cloudflare dashboard, not in wrangler.toml. Set command to `pnpm build` and output dir to the value matching `pages_build_output_dir`. The dashboard settings take precedence over wrangler.toml.
- **Cloudflare Access**: Use for private KB/documentation sites. Self-hosted docs behind CF Access + GitHub SSO (no VPN needed). Configure in Cloudflare Zero Trust dashboard. Use `aud` tags for granular route-level access policies.

## Security Patterns

- **Security Headers**: Validate multi-platform deployment configs against a single TypeScript source of truth. Include `Strict-Transport-Security: max-age=31536000`, `X-Frame-Options: DENY`, `Permissions-Policy` (restrict camera, microphone, geolocation). See web-ui-patterns for the full CSP validation pattern.
- **Secrets Management**: Never commit secrets. Use CI secrets or environment variables in the deployment platform. Validate with `git diff --check` in pre-commit hooks (catches whitespace errors and potential secret leaks). Use `secretlint` or `trufflehog` for automated scanning.
- **Dev Environment Isolation**: Separate dev/prod credentials. Use a production secrets manager (Coolify environment variables, Docker secrets, or HashiCorp Vault). Never check `.env` files into the repo — document required vars in `.env.example` instead.

### Terraform / IaC Patterns

- **State Management**: Store Terraform state in a remote backend (S3/GCS with DynamoDB/Bigtable for locking). Never use local state for production. Enable state versioning for rollback. Use `terraform workspace` per environment (dev, staging, prod).
- **Module Structure**: Organize modules by layer (networking, compute, database, monitoring). Each module declares its own variables and outputs. Use `terraform-docs` to auto-generate README for each module. Pin provider versions with `required_providers`.

### Serverless Patterns

- **Cold Start Mitigation**: Minimize import side-effects in the module scope. Use dynamic `await import()` for heavy dependencies (AWS SDK, ORM initialization). Set `functions.maxDuration` to account for cold start latency.
- **Stateless Design**: Assume every invocation runs on a fresh instance. Store session state in external storage (Redis, DB). Don't rely on in-memory caches — they disappear between invocations. Use `global` object (Node.js) for per-instance reuse but never assume it persists.
- **Response Streaming**: Use Edge Functions (Cloudflare Workers, Vercel Edge, Deno Deploy) for streaming LLM responses, real-time data, and large file transforms. Keep edge function size under 1MB (no heavy deps in edge runtime).

## Development Setup

- **macOS Setup**: Homebrew for system dependencies. asdf or volta for language version management (Node, pnpm, Python). Raycast or Alfred for launcher with custom workflows (open project, run dev server, switch Node versions).
- **VS Code**: Workspace-specific `settings.json` per project (in `.vscode/` directory) rather than global overrides. Extensions listed in `.vscode/extensions.json` (`biomejs.biome`, `dbaeumer.vscode-eslint`). Enable format on save with Biome as default formatter.
- **CLI Patterns**: Use `pnpm` scripts for all project tasks (consistent interface across contributors). `turbo` for monorepo orchestration. `biome check` for lint+format. `oxlint` for Rust-native linting (faster on large codebases). All commands are `turbo` pipeline steps, not ad-hoc npm scripts.

## Trigger Keywords

"Docker", "Dockerfile", "docker-compose", "container", "CI", "CI/CD", "GitHub Actions", "cache", "parallel jobs", "timeout", "monorepo", "pnpm catalog", "circular dependency", "madge", "TypeScript project references", "Cloudflare Pages", "Cloudflare Access", "Wrangler", "Coolify", "deploy", "secrets", "environment variables", "VS Code setup", "dev environment", "macOS setup", "infrastructure", "security headers", "HSTS", "CSP"
