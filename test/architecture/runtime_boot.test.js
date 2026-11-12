import { describe, it, expect } from 'vitest';
import { createRuntime } from '../../src/app/createRuntime.js';
import { createEventBus } from '../../src/shared/events.js';

describe('App runtime DI', () => {
  it('createRuntime exposes events and flags', () => {
    const rt = createRuntime({ flags: { experimentalPhysicsWorld: false } });
    expect(rt.flags.experimentalPhysicsWorld).toBe(false);
    let seen = false;
    rt.on('ping', () => { seen = true; });
    rt.emit('ping', {});
    expect(seen).toBe(true);
  });

  it('event bus supports unsubscribe', () => {
    const bus = createEventBus();
    let n = 0;
    const off = bus.on('x', () => { n += 1; });
    bus.emit('x');
    off();
    bus.emit('x');
    expect(n).toBe(1);
  });
});
