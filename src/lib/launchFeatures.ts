/** The member navigation for the focused Fieldwork launch. */
export const MEMBER_NAV_ITEMS = [
  { label: 'My Hours', path: '/dashboard' },
  { label: 'Monthly Verification Forms', path: '/export' },
  { label: 'Exam Prep', path: '/exam-lab' },
  { label: 'Suggestions', path: '/suggestions' },
] as const;

/** Preserved products remain available for administrator review and later release. */
export const ARCHIVED_PRODUCTS = [
  { name: 'My Path', path: '/my-path', description: 'Personal development plans and milestone tracking.' },
  { name: 'BCBA Roadmap', path: '/roadmap', description: 'The broader pathway to certification.' },
  { name: 'Baker Commons', path: '/commons', description: 'Community conversations and shared support.' },
  { name: 'Baker Brain', path: '/baker-brain', description: 'The learning assistant and saved learning resources.' },
  { name: 'Baker AI', path: '/baker-ai', description: 'The standalone AI assistant.' },
  { name: 'Resource Vault', path: '/resources', description: 'The extended resource library.' },
  { name: 'Product Overview', path: '/features', description: 'The full product catalog for a later launch.' },
  { name: 'Enterprise', path: '/enterprise', description: 'Organization and enterprise offerings.' },
  { name: 'Blog', path: '/blog', description: 'Editorial content and product updates.' },
  { name: 'Original Dashboard', path: '/admin/legacy-dashboard', description: 'The original full dashboard before the focused launch.' },
  { name: 'Original Member Workspace', path: '/admin/legacy-member-dashboard', description: 'The original member workspace and additional product shortcuts.' },
] as const;

export const ARCHIVED_PRODUCT_PATHS: ReadonlySet<string> = new Set(ARCHIVED_PRODUCTS.map(({ path }) => path));

export function isArchivedProductPath(pathname: string): boolean {
  return ARCHIVED_PRODUCT_PATHS.has(pathname.replace(/\/+$/, '') || '/');
}
