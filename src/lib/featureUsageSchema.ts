/** Shared fixed vocabulary only. Never add user-controlled labels, URLs or content. */
export const USAGE_VERSION = 'usage-v1';
export const USAGE_INTRODUCED = '2026-10-16';
export const USAGE_RETENTION_DAYS = 30;
export const USAGE_BUCKET_MS = 30 * 60 * 1000;
export const USAGE_FEATURES = {
  fieldwork: { label: 'Fieldwork', actions: ['tab_open', 'manual_form_open'] },
  my_path: { label: 'My Path', actions: ['tab_open'] },
  roadmap: { label: 'BCBA Roadmap', actions: ['tab_open'] },
  commons: { label: 'Baker Commons', actions: ['tab_open'] },
  baker_brain: { label: 'Baker Brain', actions: ['tab_open', 'quick_start_request'] },
  exam_lab: { label: 'Exam Lab', actions: ['tab_open', 'simulation_start_request'] },
  resources: { label: 'Resource Vault', actions: ['tab_open'] },
  exports: { label: 'Forms Export', actions: ['tab_open'] },
  imports: { label: 'Import', actions: ['tab_open'] },
  audit_history: { label: 'Audit history', actions: ['tab_open'] },
  baker_ai: { label: 'Baker AI', actions: ['tab_open'] },
  settings: { label: 'Account settings', actions: ['tab_open', 'billing_portal_request'] },
} as const;
export type UsageFeature = keyof typeof USAGE_FEATURES;
export const USAGE_ROUTES: Record<string, UsageFeature> = {
  '/dashboard': 'fieldwork', '/my-path': 'my_path', '/roadmap': 'roadmap', '/commons': 'commons',
  '/baker-brain': 'baker_brain', '/exam-lab': 'exam_lab', '/resources': 'resources',
  '/export': 'exports', '/import': 'imports', '/import/ripley': 'imports',
  '/audit-history': 'audit_history', '/baker-ai': 'baker_ai', '/settings': 'settings',
};
export function validUsageEvent(feature: unknown, action: unknown): feature is UsageFeature {
  return typeof feature === 'string' && Object.hasOwn(USAGE_FEATURES, feature) && typeof action === 'string'
    && (USAGE_FEATURES[feature as UsageFeature].actions as readonly string[]).includes(action);
}
