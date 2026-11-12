import defaultFlatrack from './default_flatrack.json';
import stsContainerLift from './sts_container_lift.json';

const REGISTRY = Object.freeze({
  [defaultFlatrack.id]: defaultFlatrack,
  [stsContainerLift.id]: stsContainerLift
});

export function listScenarios() {
  return Object.values(REGISTRY).map(({ id, name, version }) => ({ id, name, version }));
}

export function getScenario(id) {
  return REGISTRY[id] || null;
}

export { REGISTRY as SCENARIO_REGISTRY };
