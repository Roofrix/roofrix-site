import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { PreloadAllModules, provideRouter, withNavigationErrorHandler, withPreloading } from '@angular/router';

import { routes } from './app.routes';

const RELOAD_TS_KEY = 'chunk-reload-ts';
const RELOAD_COOLDOWN_MS = 30_000;

function handleStaleChunkError(error: unknown): void {
  const message = error instanceof Error ? error.message : String((error as any)?.error?.message ?? error);
  const isChunkLoadError = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(message);
  if (!isChunkLoadError) {
    return;
  }

  // A new deploy replaced the hashed chunk files; reload to pick up the fresh
  // index.html. The cooldown prevents a reload loop if the error persists.
  const lastReload = Number(sessionStorage.getItem(RELOAD_TS_KEY) ?? 0);
  if (Date.now() - lastReload > RELOAD_COOLDOWN_MS) {
    sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()));
    location.reload();
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withPreloading(PreloadAllModules),
      withNavigationErrorHandler((navError) => handleStaleChunkError(navError.error))
    )
  ]
};
