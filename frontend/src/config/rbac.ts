export type Role = 'super_user' | 'admin' | 'site_manager' | 'uploader' | 'viewer' | 'meter_manager';

export const PAGE_ACCESS: Record<string, Role[]> = {
  '/dashboard':   ['super_user', 'admin', 'site_manager', 'uploader', 'viewer', 'meter_manager'],
  '/onboarding':  ['super_user', 'admin'],
  '/checklist':   ['super_user', 'admin', 'site_manager', 'uploader', 'viewer', 'meter_manager'],
  '/data-entry':  ['super_user', 'admin', 'site_manager', 'uploader', 'viewer', 'meter_manager'],
  '/meters':      ['super_user', 'admin', 'site_manager', 'meter_manager'],
  '/users':       ['super_user', 'admin', 'site_manager'],
  '/reports':     ['super_user', 'admin', 'site_manager', 'viewer', 'meter_manager'],
  '/settings':    ['super_user', 'admin', 'site_manager', 'uploader', 'viewer', 'meter_manager'],
  '/help':        ['super_user', 'admin', 'site_manager', 'uploader', 'viewer', 'meter_manager'],
  '/developer-admin': ['super_user'],
};

export function canAccessPage(role: string | undefined, path: string): boolean {
  if (!role) return false;
  
  const roleLower = role.toLowerCase() as Role;
  
  // Normalize path: remove trailing slash except for root
  const normalizedPath = path.length > 1 && path.endsWith('/') 
    ? path.slice(0, -1) 
    : path;

  // Exact match first
  const allowedRoles = PAGE_ACCESS[normalizedPath];
  if (allowedRoles) {
    return allowedRoles.includes(roleLower);
  }
  
  // Default to true for any non-mapped routes (like Catch All, profile etc)
  return true;
}

export function canPerformAction(role: string | undefined, resource: string, action: 'create' | 'read' | 'update' | 'delete'): boolean {
  if (!role) return false;
  
  const r = role.toLowerCase() as Role;

  switch (resource) {
    case 'users':
      return ['super_user', 'admin', 'site_manager'].includes(r);
    case 'meters':
      return ['super_user', 'admin', 'site_manager', 'meter_manager'].includes(r);
    case 'data_entry':
      if (action === 'read') return true;
      if (r === 'viewer') return false;
      return true; // Other roles have specific field-level logic usually
    case 'reports':
      if (action === 'read') return ['super_user', 'admin', 'site_manager', 'viewer', 'meter_manager'].includes(r);
      if (action === 'create' || action === 'delete') return ['super_user', 'admin', 'site_manager'].includes(r);
      return false;
    case 'settings_org':
      return ['super_user', 'admin'].includes(r);
    case 'checklist':
      return ['super_user', 'admin', 'site_manager'].includes(r);
    default:
      return false;
  }
}
