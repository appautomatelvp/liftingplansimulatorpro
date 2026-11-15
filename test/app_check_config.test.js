import { describe, expect, it } from 'vitest';
import { requiresAppCheckSiteKey, resolveAppCheckSiteKey } from '../src/saas/app_check_config.js';

describe('environment-specific App Check configuration', () => {
  it('never reuses the production site key for preview or staging', () => {
    for (const environment of ['preview', 'staging']) {
      expect(resolveAppCheckSiteKey({ environment, productionSiteKey: 'prod-site-key' })).toBe('');
    }
  });

  it('uses an explicitly configured key for an isolated environment', () => {
    expect(resolveAppCheckSiteKey({
      environment: 'staging',
      configuredSiteKey: 'staging-site-key',
      productionSiteKey: 'prod-site-key'
    })).toBe('staging-site-key');
  });

  it('retains the production default outside isolated environments', () => {
    expect(resolveAppCheckSiteKey({ environment: 'production', productionSiteKey: 'prod-site-key' }))
      .toBe('prod-site-key');
  });

  it('requires an App Check key only for production deployments', () => {
    expect(requiresAppCheckSiteKey({ buildIsProduction: true, environment: 'production' })).toBe(true);
    expect(requiresAppCheckSiteKey({ buildIsProduction: true, environment: 'staging' })).toBe(false);
    expect(requiresAppCheckSiteKey({ buildIsProduction: false, environment: 'development' })).toBe(false);
  });
});
