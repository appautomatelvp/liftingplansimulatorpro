// @purpose: Các hằng số cấu hình và hàm thuần tính KPI, lọc đa chiều, công tắc module, mẫu Catalog và xuất CSV cho CMS
export const CMS_CONTROLLABLE_MODULES = [
  { id: 'cargo.oog', labelKey: 'featureCargoOog' },
  { id: 'cargo.specialized', labelKey: 'featureCargoSpecialized' },
  { id: 'beam.equalizer', labelKey: 'featureBeamEqualizer' },
  { id: 'beam.cascaded', labelKey: 'featureBeamCascaded' },
  { id: 'beam.truss', labelKey: 'featureBeamTruss' },
  { id: 'beam.container', labelKey: 'featureBeamContainer' },
  { id: 'beam.frame', labelKey: 'featureBeamFrame' }
];

export const QUICK_AUDIT_REASONS = [
  { id: 'paid_invoice', label: { vi: 'Kích hoạt Premium theo hóa đơn', en: 'Verified Premium invoice activation' } },
  { id: 'trial_grant', label: { vi: 'Cấp dùng thử Premium cho khách hàng', en: 'Granted time-limited Premium trial' } },
  { id: 'downgrade_expired', label: { vi: 'Chuyển về Free do hết hạn gói', en: 'Downgraded to Free after plan expiry' } },
  { id: 'security_lock', label: { vi: 'Tạm khóa tài khoản để xác minh bảo mật', en: 'Temporary lock for security verification' } },
  { id: 'restore_verified', label: { vi: 'Mở khóa sau khi xác minh hợp lệ', en: 'Restored active access after verification' } }
];

export const CATALOG_QUICK_TEMPLATES = [
  {
    id: 'shackle-bow-55t',
    templateLabel: 'Shackle 55t',
    kind: 'hardware',
    title: 'Crosby G-2130 Bow Shackle 55t',
    category: 'shackle',
    wllT: '55',
    massKg: '39',
    tier: 'free',
    enabled: true,
    notes: 'ASME B30.26 Alloy Bow Shackle (SF 6:1)'
  },
  {
    id: 'wire-sling-4leg-32mm',
    templateLabel: '4-Leg Wire Sling',
    kind: 'sling',
    title: '4-Leg IWRC Wire Rope Bridle 32mm',
    category: 'wire_rope',
    wllT: '42',
    massKg: '285',
    tier: 'free',
    enabled: true,
    notes: '6x36 IWRC EEIP Grade 1960, 60 deg design angle'
  },
  {
    id: 'beam-sts-spreader-40ft',
    templateLabel: 'STS Spreader 40ft',
    kind: 'beam',
    title: '40ft Telescopic STS Container Spreader',
    category: 'spreader_beam',
    wllT: '65',
    massKg: '8400',
    tier: 'premium',
    enabled: true,
    notes: 'ISO 40ft Twin-Lift Port Terminal Spreader'
  },
  {
    id: 'cargo-transformer-120t',
    templateLabel: 'Transformer 120t',
    kind: 'cargo',
    title: 'Power Transformer 120t Heavy OOG',
    category: 'machinery',
    wllT: '120',
    massKg: '120000',
    tier: 'premium',
    enabled: true,
    notes: 'Offset CoG heavy industrial cargo (ASME P30.1)'
  }
];

export function computeAdminKpiSummary({ users = [], catalogItems = [], flags = {}, errorSummary = {}, auditLogs = [] } = {}) {
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u?.status === 'active').length;
  const lockedOrBannedUsers = users.filter((u) => u?.status === 'locked' || u?.status === 'banned').length;
  const premiumUsers = users.filter((u) => u?.tier === 'premium').length;
  const adminCount = users.filter((u) => u?.role === 'admin').length;
  const supportCount = users.filter((u) => u?.role === 'support').length;
  const editorCount = users.filter((u) => u?.role === 'catalog-editor').length;
  const totalCatalog = catalogItems.length;
  const activeCatalog = catalogItems.filter((item) => item?.enabled !== false).length;
  const premiumCatalog = catalogItems.filter((item) => item?.tier === 'premium').length;
  const disabledList = Array.isArray(flags?.disabledModules) ? flags.disabledModules : [];
  return {
    totalUsers,
    adminCount,
    supportCount,
    editorCount,
    activeUsers,
    activePct: totalUsers ? Math.round((activeUsers / totalUsers) * 100) : 0,
    lockedOrBannedUsers,
    premiumUsers,
    premiumPct: totalUsers ? Math.round((premiumUsers / totalUsers) * 100) : 0,
    totalCatalog,
    activeCatalog,
    premiumCatalog,
    maintenanceMode: Boolean(flags?.maintenanceMode),
    freePlanLimit: Number(flags?.freePlanLimit || 20),
    disabledModulesCount: disabledList.length,
    sessionErrors: Number(errorSummary?.totalCount || 0),
    auditCount: auditLogs.length
  };
}

export function filterUsersList(users = [], { role = 'all', tier = 'all', status = 'all' } = {}) {
  return users.filter((user) => {
    const userRole = user?.role || 'user';
    const userTier = user?.tier || 'free';
    const userStatus = user?.status || 'active';
    if (role !== 'all' && userRole !== role) return false;
    if (tier !== 'all' && userTier !== tier) return false;
    if (status !== 'all' && userStatus !== status) return false;
    return true;
  });
}

export function filterCatalogList(items = [], { kind = 'all', tier = 'all', query = '' } = {}) {
  const needle = String(query ?? '').trim().toLowerCase();
  return items.filter((item) => {
    if (kind !== 'all' && item?.kind !== kind) return false;
    if (tier !== 'all' && (item?.tier || 'free') !== tier) return false;
    if (!needle) return true;
    const haystack = [item?.id, item?.title, item?.category, item?.notes].join(' ').toLowerCase();
    return haystack.includes(needle);
  });
}

export function filterAuditLogs(logs = [], { action = 'all', query = '' } = {}) {
  const needle = String(query ?? '').trim().toLowerCase();
  return logs.filter((entry) => {
    if (action !== 'all' && entry?.action !== action) return false;
    if (!needle) return true;
    const haystack = [entry?.actorUid, entry?.targetType, entry?.targetId, entry?.reason, entry?.summary].join(' ').toLowerCase();
    return haystack.includes(needle);
  });
}

export function toggleModuleInList(currentRaw, moduleId) {
  const base = Array.isArray(currentRaw)
    ? currentRaw
    : String(currentRaw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const next = new Set(base);
  if (next.has(moduleId)) next.delete(moduleId);
  else if (moduleId) next.add(moduleId);
  const list = [...next];
  return { list, text: list.join(', ') };
}

function escapeCsvCell(value) {
  const raw = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function formatTsForCsv(ts) {
  if (!ts) return '';
  const date = typeof ts?.toDate === 'function'
    ? ts.toDate()
    : (typeof ts?.seconds === 'number' ? new Date(ts.seconds * 1000) : new Date(ts));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function buildUsersCsv(users = []) {
  const header = ['uid', 'email', 'displayName', 'role', 'tier', 'status', 'createdAt', 'lastLogin'];
  const rows = users.map((u) => [
    u?.uid || u?.id || '', u?.email || '', u?.displayName || '',
    u?.role || 'user', u?.tier || 'free', u?.status || 'active',
    formatTsForCsv(u?.createdAt), formatTsForCsv(u?.lastLogin)
  ]);
  return [header, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

export function buildAuditCsv(logs = []) {
  const header = ['createdAt', 'actorUid', 'action', 'targetType', 'targetId', 'reason', 'before', 'after', 'summary'];
  const rows = logs.map((e) => [
    formatTsForCsv(e?.createdAt), e?.actorUid || '', e?.action || '',
    e?.targetType || '', e?.targetId || '', e?.reason || '',
    e?.before || '', e?.after || '', e?.summary || ''
  ]);
  return [header, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

export function triggerCsvDownload(filename, csvContent) {
  if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') return false;
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
