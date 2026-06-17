---
name: web-ui-patterns
description: Web UI patterns, accessibility, DevEx, build tools, and frontend best practices distilled from production apps.
---

# web-ui-patterns

Web UI patterns, accessibility, DevEx, build tools, and frontend best practices.

## Responsive UI Patterns

- **Responsive Dialog/Sheet/Drawer**: Switch between side-sheet (desktop) and bottom-drawer (mobile) at 640px breakpoint. Maps to platform conventions — mobile users expect bottom-sheet gestures, desktop users expect side panels. Implementation: render both variants, toggle via media query class; the bottom drawer uses `touch-action: pan-y` and a drag handle for pull-to-dismiss.
- **Mobile Bottom Navigation**: Fix nav to bottom with `safe-area-inset-bottom` padding for notches. Hidden on desktop via `md:hidden`. Follows Fitts's Law — thumb naturally rests at bottom edge. Limit to 5 items; use a "+" FAB for overflow actions.
- **Command Palette (Cmd+K)**: Fuzzy-search modal for navigation and actions. De facto standard (Linear, Vercel, Notion). Keyboard-first with `cmdk` library. Register on `metaKey + k` / `ctrlKey + k`. Uses a global context store for command registration (not a flat static array).

## Loading & Error States

- **Skeleton Loading**: Render placeholder shapes matching actual content layout. Desktop gets table skeletons, mobile gets card skeletons (same breakpoint). Shimmer animation provides working feedback via a CSS gradient sweep (`background: linear-gradient` animated with `translateX`). Use `aria-busy="true"` on the container.
- **Error Boundary with Observability**: Capture to Sentry in production, show helpful recovery UI (Try Again + Go Home), reveal technical details only in dev. Lazy-load Sentry SDK (dynamic import when DSN is configured). Class component wrapping every route/page view. Define a `FallbackComponent` prop for per-page customization.
- **Stagger Animation**: 80ms stagger delay, 280ms child duration with `[0.4, 0, 0.2, 1]` easing. Auto-disable for `prefers-reduced-motion`. WCAG 2.3.3 requirement. Use framer-motion's `staggerChildren` or manual `setTimeout` chains. Only stagger visible items (use `IntersectionObserver` to trigger on scroll).

### Performance Patterns

- **Font Loading**: Self-host woff2 fonts using `@font-face` with `font-display: swap`. Preload hero fonts in `<head>` via `<link rel="preload">`. subset fonts to Latin/Greek/Cyrillic only (reduce file size ~60%). Avoid Google Fonts CDN in production (adds DNS lookup + render-blocking request).
- **Image Optimization**: Use modern formats (avif with webp fallback). Set explicit `width` and `height` attributes to prevent Cumulative Layout Shift (CLS). Serve responsive image sets via `srcset` and `sizes` attributes. Lazy-load below-the-fold images with `loading="lazy"`.
- **CSS Containment**: Apply `contain: content` or `contain: layout style paint` to independent UI widgets. Isolates reflow to the container bounds. Use `content-visibility: auto` on long scrollable lists for automatic virtualization.
- **Bundle Analysis**: Run `vite build --report` or `rollup-plugin-visualizer` in CI on every PR. Review the treemap for duplicated modules and oversized dependencies. Set a budget warning at 250kB gzip for initial JS.

### CSS Patterns

- **Container Queries**: Use `@container` queries instead of media queries for reusable components. The component adapts to its parent container width, not the viewport. Define containers with `container-type: inline-size`.
- **Composition over Utility**: Use a utility-first base (Tailwind) for spacing/typography/color, then compose with `cn()` helper for conditional classes. Extract repeated utility groups into a component or `@apply` directive. Avoid deep nesting in component styles.
- **Layer Cascade**: Use `@layer` (reset, base, components, utilities) to control specificity without `!important`. Tailwind utilities sit in the `utilities` layer, so custom component styles can override defaults at the `components` layer.

## Theme & Color

- **oklch Color Space**: Perceptually uniform — same hue/chroma across light/dark, only lightness changes. Token-based: `--color-background: oklch(96% 0.005 298)` for light, `oklch(17% 0.01 195)` for dark. Prefer oklch over HSL for theming because lightness mappings survive mode flip without hue shift. Define all colors as CSS custom properties.
- **Theme Provider**: Support `system` as default (respects OS preference). Toggle via class on `<html>` (`.light` / `.dark`). Store preference in localStorage as `"light"`, `"dark"`, or `"system"`. On load, check localStorage first, then `matchMedia('(prefers-color-scheme: dark)')`. Listen for OS changes with `change` event on the media query.

## Forms

- **react-hook-form + Zod**: Uncontrolled form state (no re-renders on every keystroke). Schema validation with TypeScript inference. `aria-invalid` on input, `aria-describedby` linking to error element. Use `z.object()` for the schema, `z.infer` for the TypeScript type. Wrap inputs with `<Controller>` only when using controlled components.
- **Inline Field Errors**: Labels always visible. Errors appear next to the field (not in a summary). `role="alert"` on error container. Use `useForm`'s `formState.errors` per field. Clear error on input change (not on blur) for instant feedback. Disable submit button only when actively submitting, not on validation (keep it clickable so users can see what's wrong).

## Security Headers

- **CSP Validation**: Single TypeScript source of truth. Validation script reads Vercel/Netlify/Cloudflare configs and asserts they match. Runs in CI to prevent drift. Define CSP as a typed object, serialize to header string, and compare across deployment targets.
- **Standard headers**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security: max-age=31536000`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` with restrictive defaults (camera=(), microphone=(), geolocation=(), interest-cohort=()).

## DevEx & Build Tools

- **Biome + Ultracite**: Biome as single lint/format tool. Ultracite presets: `react` for Vite/Remix, `next` for Next.js, none for monorepo root. One config file at the root covers the entire workspace. Use `biome check --write` for auto-fix.
- **Bundle Optimization**: Trust modern bundlers (Rolldown) for code splitting. Manual `manualChunks` regex-based splitting increases bundle size (module duplication). Use route-level dynamic imports instead. Use `vite build --report` or `rollup-plugin-visualizer` for bundle analysis.
- **tsup → tsdown Migration**: tsdown defaults to ESM (remove `format: ['esm']`). Use `deps.alwaysBundle` instead of `noExternal`. `banner` is simplified (string not object). Update `package.json` exports field to match.
- **Build ≠ Quality**: `turbo run build` doesn't type-check or lint. Add separate `turbo typecheck` and `turbo lint` steps. Run `turbo typecheck lint build test` in CI (in that order) to fail fast.

## Electron

- **Keep Sandbox Enabled**: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`. Never set `ELECTRON_DISABLE_SANDBOX=1`. This is the only secure configuration.
- **Preload as CJS**: Preload scripts must be CommonJS (`.cjs`), not ESM. Electron's preload mechanism doesn't support ES modules.
- **Context Bridge**: Expose APIs via `contextBridge.exposeInMainWorld()`, not `preload-require`. Each API surface should be namespaced (e.g., `window.electronAPI.fileSystem.readFile`).

## Web Checklist (by priority)

- **Critical**: Unique `<title>` per page, OG metadata, sitemap, Web Vitals passing, minified bundle, code splitting, domain.
- **High Impact**: JSON-LD structured data, robots.txt, canonical URLs, optimized images, bundle analysis.
- **Standard**: RSS feed, Search Console, error monitoring, CSP headers, 404 page, analytics.
- **Nice to Have**: `llms.txt`, PWA, service worker, animated transitions.

## Accessibility

- **Form Association**: `aria-invalid` on input, `aria-describedby` linking to error element, `role="alert"` on error message. Error element ids must match the `aria-describedby` value exactly.
- **Error Summary**: `role="alert"` + `aria-labelledby` at top of form with anchor links to each invalid field. Useful for screen readers that may not announce inline errors.
- **Focus Management**: On route change, focus heading or skip-to-content link. On modal open, trap focus (use `focus-trap-react` or manual tab cycling). On modal close, return focus to trigger element.
- **Reduced Motion**: `useReducedMotion()` hook (from `prefers-reduced-motion` media query). Disable animations, skip stagger effects, show content immediately. Pass as a prop to animation components rather than checking inline.

### Web Vitals

- **LCP (Largest Contentful Paint)**: Target < 2.5s. Preload the largest image/text element (hero image, H1). Optimize TTFB with edge caching and CDN. Avoid lazy-loading above-the-fold images.
- **FID (First Input Delay) / TIN (Total Interaction Delay)**: Target < 100ms. Avoid long tasks (> 50ms) by yielding to the event loop with `setTimeout` or `scheduler.yield()`. Code-split heavy bundles so the main thread stays responsive.
- **CLS (Cumulative Layout Shift)**: Target < 0.1. Set explicit dimensions on all images, ads, embeds, and dynamic content. Reserve space for late-loading UI (placeholders, skeleton screens). Use `aspect-ratio` CSS property for responsive embeds.

## Trigger Keywords

"responsive", "dialog", "sheet", "drawer", "mobile nav", "bottom nav", "skeleton", "loading state", "error boundary", "Sentry", "stagger", "animation", "theme", "dark mode", "oklch", "form", "validation", "react-hook-form", "Zod", "CSP", "security headers", "Biome", "Ultracite", "bundle", "code split", "Rolldown", "tsup", "tsdown", "Electron", "a11y", "accessibility", "ARIA", "screen reader", "focus management", "reduced motion", "web vitals", "OpenGraph", "SEO"
