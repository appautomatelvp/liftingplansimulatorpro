const ISOLATED_ENVIRONMENTS = new Set(['preview', 'staging']);

export function resolveAppCheckSiteKey({
  environment = 'development',
  configuredSiteKey = '',
  productionSiteKey = ''
} = {}) {
  if (configuredSiteKey) return configuredSiteKey;
  if (ISOLATED_ENVIRONMENTS.has(String(environment).toLowerCase())) return '';
  return productionSiteKey;
}

export function requiresAppCheckSiteKey({ buildIsProduction = false, environment = 'development' } = {}) {
  return buildIsProduction && String(environment).toLowerCase() === 'production';
}
