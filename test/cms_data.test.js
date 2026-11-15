import { describe, expect, it, vi } from 'vitest';
import {
  buildAuditLogEntry,
  canAccessCms,
  canEditUsersAndFlags,
  canManageCatalog,
  canReadUsersAndAudit,
  commitWithAudit,
  normalizeCatalogItem,
  serializeAuditState
} from '../src/saas/cms_data.js';
import {
  buildAuditCsv,
  buildUsersCsv,
  CATALOG_QUICK_TEMPLATES,
  CMS_CONTROLLABLE_MODULES,
  computeAdminKpiSummary,
  filterAuditLogs,
  filterCatalogList,
  filterUsersList,
  toggleModuleInList
} from '../src/saas/admin_helpers.js';

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

  it('builds bounded audit log entries, requires reason for USER_ACCESS_UPDATE, and strips sensitive keys', () => {
    const entry = buildAuditLogEntry({
      actorUid: 'adm-1',
      action: 'USER_ACCESS_UPDATE',
      targetType: 'user',
      targetId: 'u-99',
      summary: 'x'.repeat(300),
      reason: 'Paid annual plan',
      before: { tier: 'free', idToken: 'secret-jwt' },
      after: { tier: 'premium', password: 'never' }
    });
    expect(entry.summary.length).toBe(240);
    expect(entry.reason).toBe('Paid annual plan');
    expect(entry.before).toBe('{"tier":"free"}');
    expect(entry.after).toBe('{"tier":"premium"}');
    expect(serializeAuditState({ long: 'a'.repeat(500) }).length).toBeLessThanOrEqual(400);

    expect(() => buildAuditLogEntry({ actorUid: 'adm-1', action: 'USER_ACCESS_UPDATE', targetType: 'user', targetId: 'u-99', reason: '   ' })).toThrow(/Reason is required/);
    expect(() => buildAuditLogEntry({ actorUid: 'adm-1', action: 'DROP_TABLE', targetType: 'user', targetId: 'u1' })).toThrow(/Unsupported audit action/);
    expect(() => buildAuditLogEntry({ actorUid: 'adm-1', action: 'FLAGS_UPDATE', targetType: 'config', targetId: '' })).toThrow(/Target ID/);
  });

  it('commits mutation and audit log atomically via commitWithAudit and never commits writes when audit validation or batch fails', async () => {
    const ops = [];
    const mockBatch = {
      update: vi.fn((ref, data) => ops.push(['update', ref, data])),
      set: vi.fn((ref, data) => ops.push(['set', ref, data])),
      commit: vi.fn().mockResolvedValue(undefined)
    };
    await commitWithAudit(
      {},
      (batch) => batch.update('users/u1', { tier: 'premium' }),
      {
        actorUid: 'adm-1',
        action: 'USER_ACCESS_UPDATE',
        targetType: 'user',
        targetId: 'u1',
        summary: 'tier->premium',
        reason: 'Support ticket #42'
      },
      {
        createBatch: () => mockBatch,
        createLogRef: () => 'adminAuditLogs/auto-id',
        timestamp: () => 'SERVER_TS'
      }
    );
    expect(mockBatch.update).toHaveBeenCalledTimes(1);
    expect(mockBatch.set).toHaveBeenCalledWith('adminAuditLogs/auto-id', expect.objectContaining({
      actorUid: 'adm-1',
      action: 'USER_ACCESS_UPDATE',
      reason: 'Support ticket #42',
      createdAt: 'SERVER_TS'
    }));
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);

    const rejectedBatch = { update: vi.fn(), set: vi.fn(), commit: vi.fn() };
    await expect(commitWithAudit(
      {},
      (batch) => batch.update('users/u1', { status: 'locked' }),
      { actorUid: 'adm-1', action: 'USER_ACCESS_UPDATE', targetType: 'user', targetId: 'u1', reason: '' },
      { createBatch: () => rejectedBatch, createLogRef: () => 'adminAuditLogs/auto' }
    )).rejects.toThrow(/Reason is required/);
    expect(rejectedBatch.update).not.toHaveBeenCalled();
    expect(rejectedBatch.commit).not.toHaveBeenCalled();

    const failingBatch = {
      update: vi.fn(),
      set: vi.fn(),
      commit: vi.fn().mockRejectedValue(new Error('PERMISSION_DENIED'))
    };
    await expect(commitWithAudit(
      {},
      (batch) => batch.update('users/u1', { status: 'locked' }),
      { actorUid: 'adm-1', action: 'USER_ACCESS_UPDATE', targetType: 'user', targetId: 'u1', reason: 'Abuse' },
      { createBatch: () => failingBatch, createLogRef: () => 'adminAuditLogs/auto' }
    )).rejects.toThrow(/PERMISSION_DENIED/);
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

  it('computes KPI summary, multi-criteria filters, module toggles, and safe CSV exports', () => {
    const users = [
      { uid: 'u1', email: 'adm@test.com', role: 'admin', tier: 'premium', status: 'active' },
      { uid: 'u2', email: 'eng@test.com', role: 'user', tier: 'free', status: 'locked' },
      { uid: 'u3', email: 'sup@test.com', role: 'support', tier: 'premium', status: 'active' }
    ];
    const catalogItems = [
      { id: 'shackle-55t', kind: 'hardware', title: 'Bow Shackle 55t', category: 'shackle', tier: 'free', enabled: true },
      { id: 'sts-40ft', kind: 'beam', title: 'STS Spreader', category: 'spreader', tier: 'premium', enabled: false }
    ];
    const auditLogs = [
      { actorUid: 'u1', action: 'USER_ACCESS_UPDATE', targetType: 'user', targetId: 'u2', reason: 'Invoice #99', summary: 'tier' },
      { actorUid: 'u1', action: 'CATALOG_UPSERT', targetType: 'catalog', targetId: 'sts-40ft', reason: '', summary: 'Spreader' }
    ];

    const kpi = computeAdminKpiSummary({
      users, catalogItems, auditLogs,
      flags: { maintenanceMode: true, freePlanLimit: 50, disabledModules: ['cargo.oog'] },
      errorSummary: { totalCount: 3 }
    });
    expect(kpi).toMatchObject({
      totalUsers: 3, adminCount: 1, supportCount: 1, activeUsers: 2, activePct: 67,
      lockedOrBannedUsers: 1, premiumUsers: 2, premiumPct: 67,
      totalCatalog: 2, activeCatalog: 1, premiumCatalog: 1,
      maintenanceMode: true, freePlanLimit: 50, disabledModulesCount: 1, sessionErrors: 3, auditCount: 2
    });

    expect(filterUsersList(users, { role: 'user', tier: 'free', status: 'locked' }).map((u) => u.uid)).toEqual(['u2']);
    expect(filterCatalogList(catalogItems, { kind: 'beam', query: 'spreader' }).map((c) => c.id)).toEqual(['sts-40ft']);
    expect(filterAuditLogs(auditLogs, { action: 'USER_ACCESS_UPDATE', query: 'invoice' })).toHaveLength(1);
    expect(CMS_CONTROLLABLE_MODULES).toHaveLength(7);
    expect(CATALOG_QUICK_TEMPLATES).toHaveLength(4);

    const toggledOn = toggleModuleInList('cargo.oog', 'beam.frame');
    expect(toggledOn.text).toBe('cargo.oog, beam.frame');
    expect(toggleModuleInList(toggledOn.list, 'cargo.oog').text).toBe('beam.frame');

    const csvUsers = buildUsersCsv([{ uid: 'u9', email: '=cmd|test', role: 'user', tier: 'free', status: 'active' }]);
    expect(csvUsers).toContain('"\'=cmd|test"');
    const csvAudit = buildAuditCsv(auditLogs);
    expect(csvAudit).toContain('"USER_ACCESS_UPDATE"');
  });
});
