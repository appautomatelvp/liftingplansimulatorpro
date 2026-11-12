import './styles/app.css';
import { bootApp } from './app/boot.js';
import { installUiControllers } from './ui/controllers/index.js';
import { createUiServices } from './ui/services/index.js';

const runtime = bootApp();
const services = createUiServices(runtime);
installUiControllers(runtime, services);

console.info('[Lifting Plan Simulator Pro] App boot complete', {
  CAE: Object.keys(runtime.deps.CAE || {}),
  GFX: Object.keys(runtime.deps.GFX || {}),
  experimentalPhysicsWorld: runtime.flags.experimentalPhysicsWorld,
  scenarios: runtime.scenarios?.list?.()?.map((s) => s.id),
  physicsPort: !!runtime.physicsPort
});

