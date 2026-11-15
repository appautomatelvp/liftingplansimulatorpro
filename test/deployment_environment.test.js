import { describe, expect, it } from 'vitest';
import { validateDeploymentEnvironment } from '../src/saas/deployment_environment.js';

describe('deployment Firebase isolation', () => {
  it('allows local development defaults', () => {
    expect(validateDeploymentEnvironment({ environment: 'development', projectId: 'safelift3d' }).valid).toBe(true);
  });

  it('requires an isolated Firebase project for preview and staging', () => {
    for (const environment of ['preview', 'staging']) {
      expect(validateDeploymentEnvironment({ environment }).valid).toBe(false);
      expect(validateDeploymentEnvironment({ environment, projectId: 'safelift3d' }).errors)
        .toContain('Preview and staging must not use the production Firebase project.');
      expect(validateDeploymentEnvironment({ environment, projectId: 'safelift3d-test' }).valid).toBe(true);
    }
  });

  it('rejects unknown deployment environment names', () => {
    expect(validateDeploymentEnvironment({ environment: 'prodution' }).valid).toBe(false);
  });
});
