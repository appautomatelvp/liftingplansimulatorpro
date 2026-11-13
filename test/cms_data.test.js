import { describe, expect, it } from 'vitest';
import {
  buildAuditLogEntry,
  canAccessCms,
  canEditUsersAndFlags,
  canManageCatalog,
  canReadUsersAndAudit,
  normalizeCatalogItem
} from '../src/saas/cms_data.js';

describe('CMS roles, immutable audit entry builder, and catalog validation', () => {
  it('enforces granular CMS permissions for admin, support, catalog-editor, and regular users', () => {
    const admin = { role: 'admin', status: 'active' };
    const support = { role: 'support', status: 'active' };
    const editor = { role: 'catalog-editor', status: 'active' };
    const lockedAdmin = { role: 'admin', status: 'locked' };
    const regular = { role: 'user', status: 'active' };

    expect(canAccessCms(admin)).toBe(true);
    expect(canEditUsersAndFlags(admin)).toBe(true);
    expect(canManageCatalog(admin)).toBe(true);

    expect(canAccessCms(support)).toBe(true);
    expect(canReadUsersAndAudit(support)).toBe(true);
    expect(canEditUsersAndFlags(support)).toBe(false);
    expect(canManageCatalog(support)).toBe(false);

    expect(canAccessCms(editor)).toBe(true);
    expect(canReadUsersAndAudit(editor)).toBe(false);
    expect(canEditUsersAndFlags(editor)).toBe(false);
    expect(canManageCatalog(editor)).toBe(true);

    expect(canAccessCms(lockedAdmin)).toBe(false);
    expect(canAccessCms(regular)).toBe(false);
  });

  it('builds bounded audit log entries and rejects invalid actions or targets', () => {
    const entry = buildAuditLogEntry({
      actorUid: 'adm-1',
      action: 'USER_ACCESS_UPDATE',
      targetType: 'user',
      targetId: 'u-99',
      summary: 'x'.repeat(300)
    });
    expect(entry.summary.length).toBe(240);
    expect(() => buildAuditLogEntry({ actorUid: 'adm-1', action: 'DROP_TABLE', targetType: 'user', targetId: 'u1' })).toThrow(/Unsupported audit action/);
    expect(() => buildAuditLogEntry({ actorUid: 'adm-1', action: 'FLAGS_UPDATE', targetType: 'config', targetId: '' })).toThrow(/Target ID/);
  });

  it('normalizes catalog metadata items and rejects invalid IDs or bounds', () => {
    const item = normalizeCatalogItem({
      id: 'Shackle_55T',
      kind: 'hardware',
      title: 'Bow Shackle 55t',
      category: 'shackle',
      wllT: '55',
      massKg: '39',
      tier: 'premium',
      enabled: true,
      notes: 'Heavy rigging catalog entry'
    }, 'cat-editor-1');
    expect(item).toMatchObject({ id: 'shackle_55t', kind: 'hardware', wllT: 55, massKg: 39, tier: 'premium', updatedBy: 'cat-editor-1' });
    expect(() => normalizeCatalogItem({ id: 'bad id!', title: 'Test' }, 'cat-editor-1')).toThrow(/Catalog ID/);
    expect(() => normalizeCatalogItem({ id: 'valid-id', title: '' }, 'cat-editor-1')).toThrow(/title is required/);
  });
});
