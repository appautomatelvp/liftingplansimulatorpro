import * as THREE_NS from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import * as CANNON from 'cannon-es';
import * as CAE from '../core/index.js';
import * as GFX from '../graphics/index.js';
import * as RIG from '../rigging/index.js';
import { createRuntime } from './createRuntime.js';
import { attachSimBundle } from 'virtual:lifting-sim';
import { createPhysicsPort } from '../sim/physics/port.js';
import { installCommandBus } from './commands/index.js';
import { createScenarioRuntime } from './scenarios/ScenarioRuntime.js';

/**
 * Application boot — wires dependencies, creates runtime, attaches sim bundle,
 * PhysicsPort, command bus, and scenario runtime.
 */
export function bootApp(options = {}) {
  const THREE = Object.assign({}, THREE_NS);
  THREE.OrbitControls = OrbitControls;
  THREE.GLTFLoader = GLTFLoader;
  THREE.OBJExporter = OBJExporter;

  window.CANNON = CANNON;
  window.CAE = CAE;
  window.GFX = GFX;
  window.RIG = RIG;

  const runtime = createRuntime({
    THREE,
    CANNON,
    CAE,
    GFX,
    RIG,
    flags: options.flags
  });

  window.__LIFTING_RUNTIME__ = runtime;

  const api = attachSimBundle({
    THREE,
    CANNON,
    CAE,
    GFX,
    RIG,
    runtime,
    autoBoot: options.autoBoot !== false
  });

  runtime.api = api;
  runtime.state = api?.getState?.() ?? runtime.state;
  runtime.phy = api?.getPhy?.() ?? runtime.phy;

  const port = createPhysicsPort(runtime);
  runtime.physicsPort = port;

  const scenarios = createScenarioRuntime(runtime, port);
  runtime.scenarios = scenarios;

  const commands = installCommandBus(runtime, port, {
    loadScenario: (id) => scenarios.load(id)
  });
  runtime.commands = commands;

  runtime.emit('app:booted', { runtime });
  return runtime;
}
