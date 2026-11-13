const SUPPORTED_ENVIRONMENTS = new Set(['development', 'preview', 'staging', 'production']);

export function validateDeploymentEnvironment({
  environment = 'development',
  projectId = '',
  productionProjectId = 'safelift3d'
} = {}) {
  const normalizedEnvironment = String(environment || 'development').toLowerCase();
  const errors = [];

  if (!SUPPORTED_ENVIRONMENTS.has(normalizedEnvironment)) {
    errors.push(`Unsupported VITE_APP_ENV: ${normalizedEnvironment}`);
  }
  if (['preview', 'staging'].includes(normalizedEnvironment)) {
    if (!projectId) errors.push('Preview and staging require an isolated VITE_FIREBASE_PROJECT_ID.');
    if (projectId && projectId === productionProjectId) {
      errors.push('Preview and staging must not use the production Firebase project.');
    }
  }

  return { environment: normalizedEnvironment, projectId, valid: errors.length === 0, errors };
}
