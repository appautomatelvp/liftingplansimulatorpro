import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const simParts = [
  'state.js',
  'ui-layout.js',
  'audio.js',
  'scene.js',
  'rigging.js',
  'cargo.js',
  'dynamics.js',
  'physics.js',
  'telemetry.js',
  'gear.js',
  'session.js',
  'library.js',
  'compliance.js',
  'plan_wizard.js'
];

function liftingSim() {
  const virtualId = '\0virtual:lifting-sim';
  return {
    name: 'lifting-sim',
    resolveId(id) {
      if (id === 'virtual:lifting-sim') return virtualId;
    },
    load(id) {
      if (id !== virtualId) return null;
      const dir = path.resolve('src/sim');
      for (const file of simParts) this.addWatchFile(path.join(dir, file));
      const body = simParts.map((file) => fs.readFileSync(path.join(dir, file), 'utf8')).join('\n');
      return [
        "import * as THREE_NS from 'three'",
        "import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'",
        "import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'",
        "import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js'",
        "import * as CANNON from 'cannon-es'",
        "import * as CAE from '/src/core/index.js'",
        "import * as GFX from '/src/graphics/index.js'",
        'const THREE = Object.assign({}, THREE_NS)',
        'THREE.OrbitControls = OrbitControls',
        'THREE.GLTFLoader = GLTFLoader',
        'THREE.OBJExporter = OBJExporter',
        'window.CANNON = CANNON;',
        'window.CAE = CAE;',
        'window.GFX = GFX;',
        body,
        'if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", bootSimulator);',
        'else bootSimulator();'
      ].join('\n');
    }
  };
}

export default defineConfig({
  plugins: [liftingSim()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1200
  },
  server: {
    port: 5173
  },
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**']
  }
});
