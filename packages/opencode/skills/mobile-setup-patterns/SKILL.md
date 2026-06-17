---
name: mobile-setup-patterns
description: Mobile app setup patterns for React Native, Expo, Android, iOS, and cross-platform concerns.
---

# mobile-setup-patterns

Mobile app setup patterns for React Native, Expo, Android, iOS, and cross-platform concerns.

## App Capabilities Checklist (Decide Before Building)

- **Data Fetching**: App-level error handling (network issues, response schema validation, toast for other errors). Network logger for dev (Reactotron, in-app logger triggered by shake/floating button). Define a shared `apiClient` that wraps `fetch` with retry logic (3 attempts, exponential backoff), timeout (10s default), and response schema validation (zod at the boundary).
- **Webview**: Error handling with exponential deferred retry. Redirection strategy (stay in webview vs open external browser). Use `react-native-webview` with `onError` and `onHttpError` handlers. For auth flows, intercept navigation to the redirect URL with `onNavigationStateChange`.
- **Storage**: Encrypted persistent storage via `expo-secure-store` (not AsyncStorage for secrets). Remote config (feature flags, static data, minimum version for force update) fetched at app launch. Cascade: in-memory cache → secure store → remote config fallback.
- **Static Pages**: Hosted as static web pages (e.g., terms, privacy, help), rendered via webview. Avoid bundling HTML in the app binary. Fetch from CDN with offline fallback.

### Navigation Patterns

- **Tab Navigator (Bottom)**: Primary navigation for the main app sections. 3-5 tabs maximum. Use `@react-navigation/bottom-tabs` with `expo-router` for file-based routing. Use icons + labels for clarity, icons-only on small screens.
- **Stack Navigator**: Modal presentation for auth flows, onboarding, and full-screen actions. Use `@react-navigation/native-stack` (native performance, not JS-based). Push vs present: push for drill-down, present for modal contexts.
- **Deep Linking**: Define a URL scheme in `app.json` (`scheme: "myapp"`). Handle universal links (iOS) and app links (Android) for link-based navigation. Test with `npx uri-scheme open myapp://path --ios`.
- **Deep Link Fallback**: If the app isn't installed, redirect to the App Store / Play Store. Use a landing page that checks `navigator.standalone` or `document.hidden` timeout to detect app launch.

### State Management

- **Server State**: Use TanStack React Query (`@tanstack/react-query`) for all server data. Cache key structure: `['resource', { id, filters }]`. Invalidate on mutation success. Use `staleTime: 5 * 60 * 1000` (5 min) for data that changes infrequently.
- **Client State**: Use React Context for truly global concerns (auth, theme, locale). Use `useReducer` for complex state logic. Avoid prop drilling beyond 3 levels — prefer composition or context.
- **Persisted State**: Use `expo-secure-store` for sensitive tokens (auth, API keys) and `@react-native-async-storage/async-storage` for non-sensitive app preferences. For cross-platform keychain access, prefer `expo-secure-store` over third-party solutions.

### Offline & Connectivity

- **Offline-First**: Use `@tanstack/react-query` with `networkMode: 'offlineFirst'`. Show stale data immediately, then revalidate when online. Use `react-native-net-info` to detect connectivity changes and display a persistent banner when offline. Queue mutations that fail due to network error and replay when connectivity returns.
- **Background Sync**: For data-entry apps, queue failed mutations using `react-native-mmkv` store. Replay in FIFO order when the network reconnects. Show a sync indicator (pending → syncing → synced) per item. Handle conflicts with "last write wins" or server-side conflict resolution.

### Biometric Authentication

- **expo-local-authentication**: Use `LocalAuthentication.authenticateAsync()` for fingerprint / Face ID. Set `disableDeviceFallback: true` to prevent PIN fallback (enforce biometric-only for sensitive operations). Fall back to app passcode if biometrics aren't enrolled. Check `hasHardwareAsync()` before showing the biometric option.
- **Secure Storage for biometry**: Store biometric keys in the Secure Enclave (iOS) / TEE (Android). Use `expo-secure-store` with `requireAuthentication: true` and `requireAuthentication: withBiometrics`. Regenerate keys when biometrics change (new fingerprint / face enrollment).

### OTA & Updates

- **Expo Updates**: Configure `expo-updates` for over-the-air JS bundle updates. Set `checkAutomatically: ON_LOAD` for active checking or `ON_ERROR_RETURN` for passive. Publish with `eas update --branch production --message "fix: ..."`. Rollback by publishing the previous update.
- **Force Update**: Check minimum app version from remote config at launch. If the installed version is below minimum, show an app store redirect modal (blocking). For non-critical updates, use a dismissible banner.
- **EAS Build Selector**: Use `expo-dev-client` for development builds (faster iteration than full EAS Build for each change). Local dev with `npx expo start --dev-client`.

## Build & Distribution

- **Credentials Management**: Android needs Play Console account + keystore + signing keys + Play Console API key. iOS needs App Store Developer account + distribution certificate + provisioning profiles + App Store Connect API keys. Never commit credentials to repo. Store in EAS Secrets or 1Password CI.
- **EAS Build Profiles**: `development` (dev client, internal), `preview` (internal for APK), `staging` (internal + env vars), `production` (app name, identifiers). Use `distribution: "internal"` for APK output. Set `android.buildType: "apk"` for preview, `"aab"` for production.
- **gitignore**: Ignore `/android` and `/ios` directories if no native modifications. Ignore `eas.json` and `credentials.json`. Keep `app.json` versioned (it contains app metadata, not secrets).
- **Env Strategy**: Define env vars in `eas.json` build profiles, not `.env` files. EAS copies project code (respects `.gitignore`). Use EAS Secrets for sensitive values. Access via `process.env.EXPO_PUBLIC_*` (Expo's convention for public env vars).
- **Build Caching**: Clear bundler cache with `expo start --clear` before builds. Cache Playwright browsers and pod installs in CI. Set `EAS_NO_VCS=1` when building in CI that doesn't have git history.

## React Native Specific

- **View is not pressable**: Use `Pressable` or `TouchableOpacity` / `TouchableHighlight` for pressable containers. `Pressable` is the modern replacement with better feedback control.
- **Push Notifications**: iOS needs APNs entitlement and proper certificate setup. Android needs FCM. Expo handles cross-platform push via Expo Push API (`expo-notifications`). Test with Expo's push notification tool in Expo Go.
- **Code Signing**: Android keystore must use 25-year validity (`-validity 9125`). iOS Distribution Certificate is Apple-issued (not self-signed) and lives in the Apple Developer Portal. These are distinct from Development Certificates used for local debugging.
- **Expo Upgrade**: Check `expo upgrade` changelog before upgrading. Test on both platforms after upgrade (packages may break differently). Use `npx expo-doctor` to diagnose upgrade issues.
- **Design Systems**: Theme-aware with platform-specific tokens. Use `Platform.OS` for iOS/Android differences (safe areas via `react-native-safe-area-context`, navigation gestures, status bar height). Define tokens per platform in a shared theme object.

## Platform-Specific: Android

- **Emulator**: Use hardware acceleration (HAXM on Intel, Hypervisor.framework on Apple Silicon). Cold boot on first launch, then save snapshots for faster starts. Test on multiple API levels (26, 30, 34) not just the latest.
- **Signing Key**: Store keystore securely, never in git. Use `apksigner verify` to check APK signatures. Google Play App Signing transfers key management to Google (enroll on first upload). Key algorithm: RSA 2048-bit, validity 25 years.
- **APK vs AAB**: Use Android App Bundle (AAB) for Play Store distribution (smaller downloads). Use APK for internal testing, CI, and sideloading. AAB requires Play Console; APK can be distributed directly.

## Platform-Specific: iOS

- **Push Notifications**: Enable Push Notifications capability in Xcode (Capabilities tab or `entitlements` file). Generate APNs authentication key (`.p8`) or certificate (`.p12`). `.p8` tokens don't expire; `.p12` certs expire yearly. Configure in developer.apple.com under Certificates, Identifiers & Profiles.
- **Simulator**: Test on multiple device types (iPhone SE, Pro Max, iPad). Simulator doesn't support push notifications natively (needs real device or `simulator-push` tool). Use `xcrun simctl boot` / `xcrun simctl shutdown` for automation.

## Security Detection

- **Jailbreak/Root Detection**: Check for common jailbreak indicators (Cydia URL scheme via `canOpenURL`, `fork()` call returning non-negative, suspicious file paths like `/Applications/Cydia.app`). Important for finance/security apps. Use `react-native-device-info` for device integrity.
- **Integrity Checks**: Verify app signature at runtime. Detect tampering or repackaging by comparing bundle signature against the known release signature.
- **Certificate Pinning**: Pin SSL certificates or public keys to prevent MITM attacks on mobile networks. Use `react-native-ssl-pinning` or `expo-network` with a pinned set of certificates.

## Trigger Keywords

"React Native", "Expo", "mobile app", "push notification", "APNs", "FCM", "EAS build", "app signing", "keystore", "code signing", "provisioning profile", "distribution certificate", "Android", "iOS", "cross-platform", "mobile checklist", "app capabilities", "webview", "emulator", "simulator", "jailbreak detection", "certificate pinning", "secure storage", "remote config", "force update", "OTA update"
