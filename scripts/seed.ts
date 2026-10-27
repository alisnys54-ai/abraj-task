import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Overridable so a real deployment never has to keep the published default
// credential — set these in the platform's env vars before going live.
const OWNER_EMAIL = process.env.SYSTEM_OWNER_EMAIL ?? 'owner@abrajalyasser.iq';
const OWNER_PASSWORD = process.env.SYSTEM_OWNER_PASSWORD ?? 'ChangeMe123!';

const MODULES = [
  'users', 'roles', 'permissions', 'departments', 'positions', 'tasks', 'task-comments',
  'task-checklists', 'attachments', 'notifications', 'activity-logs', 'reports',
  'settings', 'sessions',
  // Unified platform
  'portals', 'files', 'hr-employees', 'hr-attendance', 'hr-leaves', 'payroll', 'announcements', 'assets',
  're-projects', 're-units', 're-bookings', 're-installments', 're-site-reports', 're-tickets',
];

type Grant = { granted: boolean; scope: 'all' | 'department' | 'own' };
const ALL = (actions: string[], action: string): Grant => ({ granted: actions.includes(action), scope: 'all' });
const RW = ['view', 'create', 'edit'];

/**
 * Baseline grants for the unified-platform modules. Every grant is editable
 * afterwards from the Roles screen — this only sets a sensible starting point.
 */
function platformGrant(roleName: string, moduleName: string, action: string): Grant | null {
  const hr = ['hr-employees', 'hr-attendance', 'hr-leaves'];
  const re = ['re-projects', 're-units', 're-bookings', 're-installments', 're-site-reports', 're-tickets'];
  if (!hr.includes(moduleName) && !re.includes(moduleName) && !['portals', 'files', 'payroll', 'announcements', 'assets'].includes(moduleName)) return null;
  switch (roleName) {
    case 'General Manager':
      return { granted: true, scope: 'all' };
    case 'Department Manager':
      if (moduleName === 'files') return { granted: action === 'view', scope: 'department' };
      if (hr.includes(moduleName)) return { granted: [...RW, 'approve'].includes(action), scope: 'department' };
      if (moduleName === 'announcements') return { granted: ['view', 'create', 'delete'].includes(action), scope: 'department' };
      if (moduleName === 'payroll') return { granted: action === 'view', scope: 'department' };
      if (moduleName === 'assets' || re.includes(moduleName)) return { granted: action === 'view', scope: 'all' };
      return { granted: false, scope: 'department' };
    case 'HR Officer':
      if (hr.includes(moduleName)) return ALL([...RW, 'approve', 'export'], action);
      if (moduleName === 'payroll') return ALL([...RW, 'export'], action);
      if (moduleName === 'announcements') return ALL(['view', 'create', 'delete'], action);
      if (moduleName === 'portals') return ALL(['view'], action);
      return { granted: false, scope: 'own' };
    case 'Accountant':
      if (moduleName === 'payroll') return ALL(['view', 'approve', 'manage', 'export'], action);
      if (moduleName === 're-installments') return ALL([...RW, 'export'], action);
      if (['re-projects', 're-units', 're-bookings'].includes(moduleName)) return ALL(['view', 'export'], action);
      if (moduleName === 'announcements' || moduleName === 'hr-leaves') return { granted: ['view', 'create'].includes(action), scope: 'own' };
      return { granted: false, scope: 'own' };
    case 'Sales Officer':
      if (['re-projects', 're-units'].includes(moduleName)) return ALL(['view'], action);
      if (moduleName === 're-bookings') return { granted: RW.includes(action), scope: 'own' };
      if (moduleName === 're-installments') return { granted: action === 'view', scope: 'own' };
      if (moduleName === 're-tickets') return { granted: RW.includes(action), scope: 'own' };
      if (moduleName === 'announcements' || moduleName === 'hr-leaves') return { granted: ['view', 'create'].includes(action), scope: 'own' };
      return { granted: false, scope: 'own' };
    case 'Site Engineer':
      if (['re-projects', 're-units'].includes(moduleName)) return ALL(['view'], action);
      if (moduleName === 're-site-reports') return { granted: ['view', 'create'].includes(action), scope: 'own' };
      if (moduleName === 're-tickets') return ALL(RW, action);
      if (moduleName === 'hr-attendance') return { granted: ['view', 'create'].includes(action), scope: 'department' };
      if (moduleName === 'announcements' || moduleName === 'hr-leaves') return { granted: ['view', 'create'].includes(action), scope: 'own' };
      return { granted: false, scope: 'own' };
    default: // Employee
      if (moduleName === 'announcements') return { granted: action === 'view', scope: 'own' };
      if (moduleName === 'hr-leaves') return { granted: ['view', 'create'].includes(action), scope: 'own' };
      if (['hr-employees', 'hr-attendance'].includes(moduleName)) return { granted: action === 'view', scope: 'own' };
      return { granted: false, scope: 'own' };
  }
}
const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'assign', 'export', 'manage', 'upload', 'comment'];

function defaultGrant(roleName: string, moduleName: string, action: string): { granted: boolean; scope: 'all' | 'department' | 'own' } {
  const platform = platformGrant(roleName, moduleName, action);
  if (platform) return platform;
  if (roleName === 'General Manager') return { granted: true, scope: 'all' };

  if (roleName === 'Department Manager') {
    if (['roles', 'permissions', 'settings', 'positions'].includes(moduleName)) {
      return { granted: action === 'view', scope: 'department' };
    }
    if (action === 'manage' || action === 'delete') return { granted: false, scope: 'department' };
    return { granted: true, scope: 'department' };
  }

  // Employee
  const fullAccess = ['tasks', 'task-comments', 'task-checklists', 'attachments', 'notifications', 'reports', 'activity-logs'];
  const viewOnly = ['departments', 'positions'];
  if (fullAccess.includes(moduleName)) {
    return { granted: ['view', 'create', 'edit', 'comment', 'upload'].includes(action), scope: 'own' };
  }
  if (viewOnly.includes(moduleName)) return { granted: action === 'view', scope: 'own' };
  return { granted: false, scope: 'own' };
}

async function main() {
  const statuses = ['draft', 'pending', 'in_progress', 'on_hold', 'waiting_approval', 'completed', 'rejected', 'cancelled', 'archived'];
  for (let i = 0; i < statuses.length; i++) {
    await prisma.taskStatus.upsert({ where: { name: statuses[i] }, update: {}, create: { name: statuses[i], sortOrder: i } });
  }

  const priorities = ['low', 'medium', 'high', 'critical'];
  for (let i = 0; i < priorities.length; i++) {
    await prisma.taskPriority.upsert({ where: { name: priorities[i] }, update: {}, create: { name: priorities[i], sortOrder: i } });
  }

  const gmRole = await prisma.role.upsert({
    where: { name: 'General Manager' },
    update: {},
    create: { name: 'General Manager', description: 'Full platform access', isSystemRole: true },
  });
  const managerRole = await prisma.role.upsert({
    where: { name: 'Department Manager' },
    update: {},
    create: { name: 'Department Manager', description: 'Department-scoped management', isSystemRole: true },
  });
  const employeeRole = await prisma.role.upsert({
    where: { name: 'Employee' },
    update: {},
    create: { name: 'Employee', description: 'Personal task access', isSystemRole: true },
  });

  // Permission catalog + baseline grants for the 3 system-seeded roles — without
  // this, PermissionsGuard denies every request except the System Owner's.
  const permissionIdByKey = new Map<string, string>();
  for (const mod of MODULES) {
    for (const action of ACTIONS) {
      const perm = await prisma.permission.upsert({
        where: { module_action: { module: mod, action } },
        update: {},
        create: { module: mod, action },
      });
      permissionIdByKey.set(`${mod}:${action}`, perm.id);
    }
  }
  // Functional roles for the unified platform — task-engine access as an Employee, plus their own module grants.
  const functionalRoles: { id: string; name: string }[] = [];
  for (const [name, description] of [
    ['HR Officer', 'الموارد البشرية — الموظفون والحضور والإجازات وإعداد الرواتب'],
    ['Accountant', 'المحاسبة — اعتماد الرواتب وصرفها وتسجيل الأقساط'],
    ['Sales Officer', 'المبيعات — الحجوزات والعملاء وطلبات الصيانة'],
    ['Site Engineer', 'مهندس موقع — التقارير اليومية والصيانة وحضور الموقع'],
  ]) {
    functionalRoles.push(await prisma.role.upsert({ where: { name }, update: {}, create: { name, description, isSystemRole: true } }));
  }

  for (const role of [gmRole, managerRole, employeeRole, ...functionalRoles]) {
    for (const mod of MODULES) {
      for (const action of ACTIONS) {
        const permissionId = permissionIdByKey.get(`${mod}:${action}`)!;
        const { granted, scope } = defaultGrant(role.name, mod, action);
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId } },
          update: {},
          create: { roleId: role.id, permissionId, scope, granted },
        });
      }
    }
  }

  await seedReferenceData();

  // Minimal, name-neutral bootstrap department — required only because users.department_id
  // is NOT NULL and something must exist before the first login. The System Owner is free
  // to rename it, add children, or restructure the entire org chart from the Organization
  // Management screens; no company hierarchy is assumed here.
  const dept = await prisma.department.upsert({
    where: { name: 'Head Office' },
    update: {},
    create: { name: 'Head Office' },
  });

  const existingOwner = await prisma.user.findFirst({ where: { isSystemOwner: true } });
  if (!existingOwner) {
    if (!process.env.SYSTEM_OWNER_PASSWORD && process.env.NODE_ENV === 'production') {
      // eslint-disable-next-line no-console
      console.warn('WARNING: SYSTEM_OWNER_PASSWORD is not set — seeding with the published default password. Set SYSTEM_OWNER_PASSWORD before sharing this deployment.');
    }
    const passwordHash = await argon2.hash(OWNER_PASSWORD);
    try {
      const owner = await prisma.user.create({
        data: {
          fullName: 'System Owner',
          email: OWNER_EMAIL,
          passwordHash,
          departmentId: dept.id,
          isSystemOwner: true,
          mustChangePassword: true,
        },
      });
      await prisma.userRole.create({ data: { userId: owner.id, roleId: gmRole.id } });
      // eslint-disable-next-line no-console
      console.log(`Seeded System Owner: ${OWNER_EMAIL} (must change password on first login)`);
    } catch (e) {
      // The partial-unique index on users.is_system_owner is the real guarantee;
      // P2002 here just means a concurrent deploy/instance won the race a moment
      // earlier — that's success, not a failure, so swallow only this one code.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // eslint-disable-next-line no-console
        console.log('System Owner already exists (created concurrently by another instance) — skipping.');
      } else {
        throw e;
      }
    }
  }

  // Demo organisation for showcasing and QA only — never set this in production.
  if (process.env.SEED_DEMO_DATA === 'true') {
    const { seedDemoData } = await import('./seed-demo');
    await seedDemoData(prisma);
  }
}

/**
 * The company's real, published reference data (from the company profile and
 * the projects' investment licenses) — idempotent, safe in production.
 */
async function seedReferenceData() {
  const projects: { key: string; name: string; kind: string; portal: 'riyasa' | 'qudah' | null; governorate: string; description?: string }[] = [
    { key: 'riyasa', name: 'مجمع الرئاسة السكني الاستثماري', kind: 'residential', portal: 'riyasa', governorate: 'الديوانية' },
    { key: 'qudah', name: 'مجمع القضاة السكني', kind: 'residential', portal: 'qudah', governorate: 'الديوانية · واسط' },
    { key: 'qasim', name: 'مجمع القاسم السكني', kind: 'residential', portal: null, governorate: 'النجف الأشرف', description: 'أبو صخير — 42 دونماً — إجازة استثمارية رقم 210' },
    { key: 'concrete-plant', name: 'معمل كونكريت متكامل', kind: 'industrial', portal: null, governorate: 'النجف الأشرف', description: 'المنطقة الصناعية، ناحية الرضوية — 10,000 م² لمدة 25 سنة' },
    { key: 'military-market', name: 'سوق نموذجي — سوق الحي العسكري', kind: 'commercial', portal: null, governorate: 'النجف الأشرف', description: '44 محلاً تجارياً' },
    { key: 'alnoor-schools', name: 'مدارس النور الابتدائية والثانوية', kind: 'education', portal: null, governorate: 'النجف الأشرف', description: 'حي الحسين — 2,341 م²' },
  ];
  const ids: Record<string, string> = {};
  for (const p of projects) {
    ids[p.key] = (await prisma.residentialProject.upsert({ where: { key: p.key }, update: {}, create: p })).id;
  }

  const sites = [
    { code: 'rdiw', project: 'riyasa', name: 'مجمع الرئاسة السكني الاستثماري', location: 'الديوانية — التقية الثالثة / آلبو صالح', license: '76/2025', costLabel: '155,819,206,276 د.ع', authority: 'هيئة استثمار الديوانية', progress: 38, phase: 'الهيكل الإنشائي للبلوكات 1–4 والبنى التحتية للشارع الرئيسي', totalUnits: 1087,
      types: [ ['A', 141.23, 110865000], ['B', 194.27, 152500000], ['D', 216.88, 170250000], ['G', 172.5, 135412000], ['K', 283.9, 222860000] ] as [string, number, number | null][] },
    { code: 'qdiw', project: 'qudah', name: 'مجمع القضاة السكني الاستثماري — الديوانية', location: 'الديوانية — التقية الأولى · مركز المدينة', license: '61/2022', costLabel: '16,884,593 $', authority: 'هيئة استثمار الديوانية', progress: 64, phase: 'التشطيبات الخارجية والأسيجة والبنى التحتية', totalUnits: 172,
      types: [ ['A', 400, null], ['B', 260, null] ] as [string, number, number | null][] },
    { code: 'qwas', project: 'qudah', name: 'مجمع دور القضاة السكني — واسط', location: 'واسط — مركز المدينة / أم هليل مقاطعة 3', license: '91 سكني', costLabel: '19,748,249,726 د.ع', authority: 'هيئة استثمار واسط', progress: 52, phase: 'الهيكل الإنشائي وأعمال الأسيجة', totalUnits: 210,
      types: [ ['1', 0, null], ['2', 0, null] ] as [string, number, number | null][] },
  ];
  for (const s of sites) {
    const { types, project, ...data } = s;
    const site = await prisma.projectSite.upsert({ where: { code: s.code }, update: {}, create: { ...data, projectId: ids[project] } });
    for (const [code, area, price] of types) {
      await prisma.unitType.upsert({ where: { siteId_code: { siteId: site.id, code } }, update: {}, create: { siteId: site.id, code, areaM2: area, price } });
    }
  }

  for (const p of [
    { name: 'المعمل الرئيسي', location: 'النجف — مقابل الشركة العامة للإسمنت الجنوبية', kind: 'خرسانة جاهزة', capacity: '200 م³/ساعة' },
    { name: 'معمل الديوانية', location: 'محيط مجمع الرئاسة', kind: 'خرسانة جاهزة', capacity: '160 م³/ساعة' },
    { name: 'المعمل المتنقل', location: 'واسط — محيط مدينة الكوت', kind: 'خرسانة جاهزة', capacity: '90 م³/ساعة' },
    { name: 'معمل الرمل المغسول', location: 'النجف — محيط بحر النجف', kind: 'رمل مغسول', capacity: '10 دونم' },
    { name: 'المقلع', location: 'النجف', kind: 'مقلع', capacity: '300 دونم' },
  ]) {
    await prisma.plant.upsert({ where: { name: p.name }, update: {}, create: p });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
