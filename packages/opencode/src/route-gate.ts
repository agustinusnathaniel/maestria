import type { Route } from '@/modes/types.js';
import type { LandingReviewState } from '@/landing-review.js';
import { isApprovedShippingCommand, isShippingCommand } from '@/shipping.js';

export const MAESTRIA_ROUTE_TOOL = 'maestria_route';
export const LANDING_REVIEW_ROUTE = 'landing-review';

/**
 * OpenCode's built-in tools. Unknown names are deliberately not treated as
 * native tools so direct mode remains bounded to the OpenCode tool surface.
 */
export const NATIVE_TOOLS = new Set([
  'apply_patch',
  'bash',
  'batch',
  'edit',
  'glob',
  'grep',
  'lsp',
  'list',
  'patch',
  'question',
  'read',
  'skill',
  'task',
  'todowrite',
  'webfetch',
  'websearch',
]);

const DIRECT_BLOCKED_TOOLS = new Set(['batch', 'task']);
const DISPATCHER_TOOLS = new Set([MAESTRIA_ROUTE_TOOL, 'question', 'task', 'todowrite']);
export const LANDING_REVIEW_TOOL = 'maestria_landing_review';

export class RouteGateError extends Error {
  override name = 'RouteGateError';
}

/**
 * Return whether a tool is available to a root orchestrator in the route.
 * A null route is the fail-closed state before the user or selector chooses a
 * route. Unknown tools are denied in every route except the explicitly
 * bounded native-tool set in direct mode.
 */
export function isToolAllowed(
  route: Route | null,
  toolName: string,
  args?: unknown,
  landingReviewState: LandingReviewState = 'inactive',
): boolean {
  if (route === null) return toolName === MAESTRIA_ROUTE_TOOL;

  if (route === 'direct') {
    if (toolName === MAESTRIA_ROUTE_TOOL) {
      return Boolean(
        args &&
        typeof args === 'object' &&
        (args as Record<string, unknown>).route === LANDING_REVIEW_ROUTE,
      );
    }
    const command =
      args && typeof args === 'object' ? (args as Record<string, unknown>).command : undefined;
    return (
      NATIVE_TOOLS.has(toolName) &&
      !DIRECT_BLOCKED_TOOLS.has(toolName) &&
      !(toolName === 'bash' && isShippingCommand(command))
    );
  }

  if (route === LANDING_REVIEW_ROUTE) {
    if (landingReviewState === 'armed') return toolName === LANDING_REVIEW_TOOL;
    if (landingReviewState !== 'approved') return false;

    const command =
      args && typeof args === 'object' ? (args as Record<string, unknown>).command : undefined;
    return toolName === 'bash' && isApprovedShippingCommand(command);
  }

  return DISPATCHER_TOOLS.has(toolName);
}

export function assertToolAllowed(
  route: Route | null,
  toolName: string,
  args?: unknown,
  landingReviewState: LandingReviewState = 'inactive',
): void {
  if (isToolAllowed(route, toolName, args, landingReviewState)) return;

  const routeName = route ?? 'unselected';
  throw new RouteGateError(
    `[maestria] Route "${routeName}" (landing state "${landingReviewState}") does not permit tool "${toolName}". ` +
      'Select the appropriate route with maestria_route before continuing.',
  );
}
