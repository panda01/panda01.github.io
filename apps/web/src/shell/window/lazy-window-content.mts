import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import type { AppWindowContentProps } from '../../system/app-registry/app-manifest.types.mts';
import { appManifests } from '../../system/app-registry/app-registry.mts';

/** A window content component that loads its app's code on first render. */
export type LazyWindowContent = LazyExoticComponent<ComponentType<AppWindowContentProps>>;

/**
 * One lazily loaded content component per app, created once when this module loads (never during
 * render), so an app's code downloads only the first time one of its windows opens.
 */
export const lazyWindowContentByAppId: Readonly<Record<string, LazyWindowContent>> =
  Object.fromEntries(
    appManifests.map((appManifest) => [appManifest.id, lazy(appManifest.loadWindowContent)]),
  );
