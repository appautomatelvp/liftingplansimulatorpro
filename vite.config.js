import { defineConfig, loadEnv } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateDeploymentEnvironment } from './src/saas/deployment_environment.js';

async function loadManifestParts() {
  const manifestPath = path.resolve('src/sim/manifest.js');
  // Cache-bust ESM import so manifest edits (new SIM_PARTS) apply without restart.
  const mod = await import(`${pathToFileURL(manifestPath).href}?t=${Date.now()}`);
  return {
    SIM_PARTS: mod.SIM_PARTS,
    SIM_PARTS_HEADLESS: mod.SIM_PARTS_HEADLESS
  };
}

function liftingSim() {
  const virtualId = '\0virtual:lifting-sim';

  return {
    name: 'lifting-sim',
    resolveId(id) {
      if (id === 'virtual:lifting-sim') return virtualId;
    },
    async load(id) {
      if (id !== virtualId) return null;
      // Always re-read manifest so newly added parts (e.g. weather_fx.js) are
      // picked up without requiring a full Vite restart.
      const m = await loadManifestParts();
      const partsCache = m.SIM_PARTS;
      const dir = path.resolve('src/sim');
      for (const file of partsCache) this.addWatchFile(path.join(dir, file));
      this.addWatchFile(path.resolve('src/sim/manifest.js'));

      const missing = partsCache.filter((file) => !fs.existsSync(path.join(dir, file)));
      if (missing.length) {
        throw new Error(`[lifting-sim] Missing SIM_PARTS: ${missing.join(', ')}`);
      }

      const body = partsCache
        .map((file) => fs.readFileSync(path.join(dir, file), 'utf8'))
        .join('\n');

      return [
        'export function attachSimBundle(deps) {',
        '  const THREE = deps.THREE;',
        '  const CANNON = deps.CANNON;',
        '  const CAE = deps.CAE;',
        '  const GFX = deps.GFX;',
        '  const RIG = deps.RIG;',
        '  const XPBDCableDynamics = deps.XPBDCableDynamics;',
        '  const runtime = deps.runtime || null;',
        '  const autoBoot = deps.autoBoot !== false;',
        body,
        '  const api = {',
        '    getState: () => (typeof state !== "undefined" ? state : null),',
        '    getPhy: () => (typeof phy !== "undefined" ? phy : null),',
        '    getRigSpec: typeof getRigSpec === "function" ? () => getRigSpec() : null,',
        '    getCurrentLiftPlanSummary: typeof getCurrentLiftPlanSummary === "function" ? getCurrentLiftPlanSummary : null,',
        '    bootSimulator: typeof bootSimulator === "function" ? bootSimulator : null,',
        '    pretensionRig: typeof pretensionRig === "function" ? pretensionRig : null,',
        '    stepPhysicsEngine: typeof stepPhysicsEngine === "function" ? stepPhysicsEngine : null,',
        '    rebuildCargoAndRig: typeof rebuildCargoAndRig === "function" ? rebuildCargoAndRig : null,',
        '    beginSmoothSetDown: typeof beginSmoothSetDown === "function" ? beginSmoothSetDown : null,',
        '    finishSmoothSetDown: typeof finishSmoothSetDown === "function" ? finishSmoothSetDown : null,',
        '    resetToInitialPreLiftState: typeof resetToInitialPreLiftState === "function" ? resetToInitialPreLiftState : null,',
        '    resetAllToFactoryDefaults: typeof resetAllToFactoryDefaults === "function" ? resetAllToFactoryDefaults : null,',
        '    autoPositionHookForLift: typeof autoPositionHookForLift === "function" ? autoPositionHookForLift : null',
        '  };',
        '  if (runtime) {',
        '    runtime.state = api.getState();',
        '    runtime.phy = api.getPhy();',
        '    runtime.api = api;',
        '  }',
        '  if (autoBoot && typeof bootSimulator === "function") {',
        '    if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", bootSimulator);',
        '    else bootSimulator();',
        '  }',
        '  return api;',
        '}'
      ].join('\n');
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const deployment = validateDeploymentEnvironment({
    environment: env.VITE_APP_ENV || 'development',
    projectId: env.VITE_FIREBASE_PROJECT_ID || ''
  });

  if (!deployment.valid) {
    throw new Error(`[deployment-env] ${deployment.errors.join(' ')}`);
  }

  return {
    plugins: [liftingSim()],
    build: {
      outDir: 'dist',
      sourcemap: mode === 'staging',
      chunkSizeWarningLimit: 1200
    },
    server: {
      port: 5173
    },
    test: {
      exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
      // Headless physics regression cases run several thousand simulation steps.
      testTimeout: 30000,
      // Avoid over-subscribing the two-core GitHub runner with parallel physics worlds.
      maxWorkers: 2
    }
  };
});
