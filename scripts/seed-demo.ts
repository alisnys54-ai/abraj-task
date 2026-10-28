import { PrismaClient, PortalKey, UnitStatus } from '@prisma/client';
import * as argon2 from 'argon2';

/**
 * Demo organisation for showcasing and QA (SEED_DEMO_DATA=true). Every person
 * here is fictional; unit numbering is generated. The real reference data
 * (projects, sites, unit types, prices, plants) comes from seed.ts.
 *
 * Every demo account's password is DEMO_PASSWORD (default Demo@2026!).
 */
export async function seedDemoData(prisma: PrismaClient) {
  const password = await argon2.hash(process.env.DEMO_PASSWORD ?? 'Demo@2026!');
  const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  const day = (offset: number) => new Date(today.getTime() + offset * 86_400_000);

  // ---- departments
  const deptNames = ['الإدارة والمالية', 'المبيعات والتسويق', 'الإنشاء والمواقع', 'المعامل والنقل', 'الهندسة والمختبر'];
  const dept: Record<string, string> = {};
  for (const name of deptNames) dept[name] = (await prisma.department.upsert({ where: { name }, update: {}, create: { name } })).id;

  const role = async (name: string) => (await prisma.role.findUniqueOrThrow({ where: { name } })).id;

  // ---- people: [name, email, dept, role, portals, employeeNo, position, salary]
  const people: [string, string, string, string, PortalKey[], string, string, number][] = [
    ['فاطمة حسن الياسري', 'fatima@demo.abraj', 'الإدارة والمالية', 'Department Manager', ['company', 'tasks'], 'AY-1071', 'مديرة الإدارة والمالية', 2_400_000],
    ['نور الهدى علي الشمري', 'nour@demo.abraj', 'الإدارة والمالية', 'HR Officer', ['company', 'tasks'], 'AY-1041', 'موارد بشرية', 1_300_000],
    ['حسين جبار المحنا', 'hussein@demo.abraj', 'الإدارة والمالية', 'Accountant', ['company', 'riyasa', 'qudah', 'tasks'], 'AY-1044', 'محاسب', 1_450_000],
    ['زينب عبد الأمير الحسيني', 'zainab@demo.abraj', 'المبيعات والتسويق', 'Department Manager', ['company', 'riyasa', 'qudah', 'tasks'], 'AY-1018', 'مديرة المبيعات', 2_200_000],
    ['علي حسين الموسوي', 'ali@demo.abraj', 'المبيعات والتسويق', 'Sales Officer', ['riyasa', 'tasks'], 'AY-1047', 'مشرف مبيعات', 1_250_000],
    ['رسل فاضل الجنابي', 'rusul@demo.abraj', 'المبيعات والتسويق', 'Sales Officer', ['qudah', 'tasks'], 'AY-1117', 'مسوّقة — مركز واسط', 1_100_000],
    ['حيدر كاظم الجبوري', 'haider@demo.abraj', 'الإنشاء والمواقع', 'Department Manager', ['company', 'riyasa', 'qudah', 'tasks'], 'AY-1002', 'مدير الإنشاء والمواقع', 2_600_000],
    ['مصطفى جواد الخفاجي', 'mustafa@demo.abraj', 'الإنشاء والمواقع', 'Site Engineer', ['qudah', 'tasks'], 'AY-1033', 'مهندس موقع', 1_600_000],
    ['أمير ستار الشمري', 'ameer@demo.abraj', 'الإنشاء والمواقع', 'Employee', ['tasks'], 'AY-1121', 'أمين مخزن', 950_000],
    ['سجاد رحيم العبودي', 'sajjad@demo.abraj', 'المعامل والنقل', 'Department Manager', ['company', 'tasks'], 'AY-1064', 'مسؤول المعامل والنقل', 2_100_000],
    ['كرار محمد الحسناوي', 'karrar@demo.abraj', 'المعامل والنقل', 'Employee', ['tasks'], 'AY-1108', 'مشرف صيانة الآليات', 1_150_000],
    ['عباس ناصر الزبيدي', 'abbas@demo.abraj', 'الهندسة والمختبر', 'Department Manager', ['company', 'qudah', 'tasks'], 'AY-1085', 'مدير الهندسة والمختبر', 2_300_000],
    ['أحمد صباح الكعبي', 'ahmed@demo.abraj', 'الهندسة والمختبر', 'Site Engineer', ['riyasa', 'tasks'], 'AY-1056', 'مهندس مختبر', 1_500_000],
  ];
  const user: Record<string, string> = {};
  for (const [fullName, email, d, r, portals, employeeNo, position, salary] of people) {
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { fullName, email, passwordHash: password, departmentId: dept[d], mustChangePassword: false },
    });
    user[email] = u.id;
    await prisma.userRole.upsert({ where: { userId_roleId: { userId: u.id, roleId: await role(r) } }, update: {}, create: { userId: u.id, roleId: await role(r) } });
    for (const portal of portals) await prisma.userPortalAccess.upsert({ where: { userId_portal: { userId: u.id, portal } }, update: {}, create: { userId: u.id, portal } });
    if (r === 'Department Manager') {
      await prisma.departmentManager.upsert({ where: { departmentId_userId: { departmentId: dept[d], userId: u.id } }, update: {}, create: { departmentId: dept[d], userId: u.id } });
    }
    await prisma.employee.upsert({
      where: { employeeNo },
      update: {},
      create: { employeeNo, fullName, departmentId: dept[d], workLocation: position, baseSalary: salary, userId: u.id, hireDate: new Date(Date.UTC(2019 + (salary % 5), 2, 1)) },
    });
  }

  // ---- site staff without logins (most of the 412)
  const sites = Object.fromEntries((await prisma.projectSite.findMany()).map((s) => [s.code, s]));
  const workers = ['جاسم', 'مرتضى', 'حسن', 'كاظم', 'عمار', 'علاء', 'سلام', 'رعد', 'ضياء', 'منتظر', 'باسم', 'فلاح', 'وسام', 'ميثم', 'صادق', 'حمزة', 'قاسم', 'نبيل'];
  const families = ['العبادي', 'الفتلاوي', 'الكرعاوي', 'الزيدي', 'الجبوري', 'الخزاعي', 'العامري', 'الحمداني', 'الشبلي'];
  for (let i = 0; i < 36; i++) {
    const employeeNo = `AY-${1200 + i}`;
    const site = ['rdiw', 'qdiw', 'qwas'][i % 3];
    await prisma.employee.upsert({
      where: { employeeNo },
      update: {},
      create: {
        employeeNo, fullName: `${workers[i % workers.length]} ${workers[(i * 7 + 3) % workers.length]} ${families[i % families.length]}`,
        departmentId: dept[i % 4 === 3 ? 'المعامل والنقل' : 'الإنشاء والمواقع'], siteId: sites[site]?.id,
        workLocation: i % 4 === 3 ? 'سائق خباطة' : 'عامل بناء', baseSalary: 650_000 + (i % 5) * 50_000, phone: `078${String(10000000 + i * 7331).slice(0, 8)}`,
      },
    });
  }

  // ---- units: generated numbering, status mix close to the published split
  const splits: Record<string, number[]> = { rdiw: [412, 238, 301, 136], qdiw: [38, 41, 79, 14], qwas: [64, 37, 52, 57] };
  const order: UnitStatus[] = ['available', 'reserved', 'sold', 'under_construction'];
  for (const code of Object.keys(splits)) {
    const site = sites[code];
    if (!site) continue;
    if ((await prisma.unit.count({ where: { siteId: site.id } })) > 0) continue;
    const types = await prisma.unitType.findMany({ where: { siteId: site.id }, orderBy: { code: 'asc' } });
    const blocks = code === 'rdiw' ? 8 : code === 'qdiw' ? 6 : 5;
    const statuses = splits[code].flatMap((n, i) => Array(n).fill(order[i]) as UnitStatus[]);
    // Interleave so every block shows a realistic mix rather than all-sold blocks.
    const mixed = statuses.map((s, i) => ({ s, k: (i * 7919) % statuses.length })).sort((a, b) => a.k - b.k).map((x) => x.s);
    await prisma.unit.createMany({
      data: mixed.map((status, i) => {
        const block = String((i % blocks) + 1);
        return { siteId: site.id, unitTypeId: types[i % types.length].id, block, number: `${block}${String(Math.floor(i / blocks) + 101).padStart(3, '0')}`, status };
      }),
    });
  }

  // ---- bookings with installment plans (Riyasa has published prices)
  const clients = ['محمد عبد الحسين الربيعي', 'سارة كريم العامري', 'القاضي جبار ناصر الفتلاوي', 'علاء مهدي الشبلي', 'هدى عباس المياحي', 'رائد سلمان الحمداني', 'إيمان جاسم الغزالي', 'القاضية نادية حميد الكعبي'];
  if ((await prisma.booking.count()) === 0) {
    for (let i = 0; i < clients.length; i++) {
      const siteCode = i < 5 ? 'rdiw' : i < 7 ? 'qdiw' : 'qwas';
      const unit = await prisma.unit.findFirst({ where: { siteId: sites[siteCode].id, status: 'available' }, include: { unitType: true }, orderBy: { number: 'asc' }, skip: i });
      if (!unit) continue;
      const client = await prisma.client.create({ data: { fullName: clients[i], phone: `0780${String(1234567 + i * 1111).slice(0, 7)}` } });
      const price = unit.unitType.price ? Number(unit.unitType.price) : null;
      const deposit = price && i % 3 !== 2 ? Math.round(price * 0.05) : 0;
      const rep = siteCode === 'rdiw' ? user['ali@demo.abraj'] : user['rusul@demo.abraj'];
      const booking = await prisma.booking.create({
        data: { unitId: unit.id, clientId: client.id, salesRepId: rep, createdBy: rep, price, depositAmount: deposit, status: deposit ? 'confirmed' : 'pending_deposit', bookingDate: day(-60 + i * 6) },
      });
      await prisma.unit.update({ where: { id: unit.id }, data: { status: deposit ? 'sold' : 'reserved' } });
      if (price && deposit) {
        const n = 12, financed = Math.round(price * 0.05), base = Math.floor(financed / n);
        for (let k = 0; k < n; k++) {
          const due = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 3 + k, 10));
          const paid = due < day(-20) && !(i === 1 && k === 1);
          await prisma.installment.create({
            data: {
              bookingId: booking.id, seq: k + 1, dueDate: due, amount: k === n - 1 ? financed - base * (n - 1) : base,
              ...(paid ? { status: 'paid' as const, paidAmount: k === n - 1 ? financed - base * (n - 1) : base, paidAt: due, receiptNo: `RC-${2600 + i * 20 + k}`, recordedBy: user['hussein@demo.abraj'] } : {}),
            },
          });
        }
      }
    }
  }

  // ---- site reports & tickets
  if ((await prisma.siteDailyReport.count()) === 0) {
    const reports: [string, string, number, string, number, number][] = [
      ['rdiw', 'ahmed@demo.abraj', -1, 'صب سقف البلوك 3 (الوحدات 3104–3112)، وفحص مكعبات الخرسانة في المختبر.', 214, 86],
      ['rdiw', 'ahmed@demo.abraj', -2, 'تسليح أعمدة البلوك 4 واستلام شحنة حديد 16 ملم.', 198, 0],
      ['qdiw', 'mustafa@demo.abraj', -1, 'تركيب أسيجة البلوك 2 وأعمال الإنارة الجدارية على شارع 40.', 76, 0],
      ['qwas', 'mustafa@demo.abraj', -3, 'صب أعمدة البلوك 3 من المعمل المتنقل.', 92, 54],
    ];
    for (const [code, email, offset, summary, workers, concrete] of reports) {
      await prisma.siteDailyReport.create({ data: { siteId: sites[code].id, engineerId: user[email], reportDate: day(offset), summary, workers, concreteM3: concrete } });
    }
    const tickets: [string, string, 'low' | 'medium' | 'high', 'open' | 'in_progress' | 'closed'][] = [
      ['rdiw', 'تسرب ماء في سقف الحمام — وحدة مسلّمة', 'high', 'open'],
      ['rdiw', 'باب المدخل لا يُقفل بإحكام', 'medium', 'in_progress'],
      ['qdiw', 'ضعف ضغط الماء في الطابق الأول', 'medium', 'open'],
      ['qwas', 'تشقق بسيط في لبخ الواجهة', 'low', 'closed'],
    ];
    for (let i = 0; i < tickets.length; i++) {
      const [code, title, priority, status] = tickets[i];
      await prisma.maintenanceTicket.create({
        data: { code: `MT-${String(i + 1).padStart(4, '0')}`, siteId: sites[code].id, title, priority, status, createdBy: user['zainab@demo.abraj'], assigneeId: user['mustafa@demo.abraj'], closedAt: status === 'closed' ? day(-2) : null },
      });
    }
  }

  // ---- HR: leaves, today's attendance, announcements, payroll draft, equipment
  const emp = async (no: string) => (await prisma.employee.findUniqueOrThrow({ where: { employeeNo: no } })).id;
  if ((await prisma.leaveRequest.count()) === 0) {
    await prisma.leaveRequest.create({ data: { employeeId: await emp('AY-1018'), type: 'annual', startDate: day(6), days: 5, reason: 'سفر عائلي', requestedBy: user['zainab@demo.abraj'] } });
    await prisma.leaveRequest.create({ data: { employeeId: await emp('AY-1033'), type: 'sick', startDate: day(1), days: 3, reason: 'مراجعة طبية', requestedBy: user['mustafa@demo.abraj'] } });
    await prisma.leaveRequest.create({ data: { employeeId: await emp('AY-1108'), type: 'hourly', startDate: day(2), hours: 4, requestedBy: user['karrar@demo.abraj'] } });
  }
  if ((await prisma.attendanceRecord.count({ where: { date: today } })) === 0) {
    const staff = await prisma.employee.findMany({ select: { id: true }, orderBy: { employeeNo: 'asc' } });
    await prisma.attendanceRecord.createMany({
      data: staff.slice(0, Math.floor(staff.length * 0.9)).map((e, i) => ({
        employeeId: e.id, date: today, status: i % 11 === 5 ? 'late' : i % 17 === 9 ? 'absent' : 'present',
        checkIn: i % 17 === 9 ? null : i % 11 === 5 ? '07:42' : `06:${String(40 + (i % 18)).padStart(2, '0')}`, recordedBy: user['nour@demo.abraj'],
      })),
    });
  }
  if ((await prisma.announcement.count()) === 0) {
    await prisma.announcement.create({ data: { title: 'تحديث نظام البصمة في موقع مجمع الرئاسة', body: 'يبدأ العمل بأجهزة البصمة الجديدة في بوابة الموقع اعتباراً من الأحد. يرجى من جميع الموظفين تسجيل بصماتهم لدى الموارد البشرية.', category: 'إداري', pinned: true, publishedBy: user['nour@demo.abraj'] } });
    await prisma.announcement.create({ data: { title: 'دورة السلامة المهنية لفرق المعامل', body: 'دورة إلزامية لسائقي الخباطات ومشغلي المضخات يوم الخميس في المعمل الرئيسي.', category: 'سلامة', audience: 'department', departmentId: dept['المعامل والنقل'], publishedBy: user['sajjad@demo.abraj'] } });
  }
  const m = today.getUTCMonth() + 1, y = today.getUTCFullYear();
  if (!(await prisma.payrollPeriod.findUnique({ where: { year_month: { year: y, month: m } } }))) {
    const period = await prisma.payrollPeriod.create({ data: { year: y, month: m, createdBy: user['nour@demo.abraj'] } });
    const staff = await prisma.employee.findMany({ where: { status: { in: ['active', 'on_leave'] } }, select: { id: true, baseSalary: true } });
    await prisma.payrollEntry.createMany({ data: staff.map((e) => ({ periodId: period.id, employeeId: e.id, baseSalary: e.baseSalary, netPay: e.baseSalary })) });
  }
  if ((await prisma.equipment.count()) === 0) {
    const plants = Object.fromEntries((await prisma.plant.findMany()).map((p) => [p.name, p.id]));
    const fleet: [string, string, string, number][] = [
      ['MX', 'خباطة', 'Mercedes Actros 9/10 م³', 32], ['PM', 'مضخة', 'Schwing — ذراع 52/42/36/34 م', 9], ['PS', 'مضخة أرضية', 'Schwing ثابتة', 2],
      ['EX', 'حفارة', 'Hitachi ZX210', 6], ['LD', 'شفل', 'Kawasaki', 6], ['TR', 'قلاب', 'قلاب بمقطورة 50 م³', 6], ['RL', 'حادلة', 'ضلفية ومع رولة', 10], ['CR', 'كرين', 'مختلف الأحجام', 3],
    ];
    const plantIds = [plants['المعمل الرئيسي'], plants['معمل الديوانية'], plants['المعمل المتنقل']];
    for (const [prefix, category, model, count] of fleet) {
      await prisma.equipment.createMany({
        data: Array.from({ length: count }, (_, i) => ({
          code: `${prefix}-${String(i + 1).padStart(2, '0')}`, category, model, plantId: plantIds[i % 3],
          status: i % 9 === 4 ? 'maintenance' as const : i % 13 === 7 ? 'out_of_service' as const : 'operational' as const,
        })),
      });
    }
  }

  // ---- a few tasks so the task engine and the proof rule have something to show
  if ((await prisma.task.count({ where: { code: { startsWith: 'DEMO-' } } })) === 0) {
    const st = Object.fromEntries((await prisma.taskStatus.findMany()).map((s) => [s.name, s.id]));
    const pr = Object.fromEntries((await prisma.taskPriority.findMany()).map((s) => [s.name, s.id]));
    const tasks: [string, string, string, string, string, string, string, number][] = [
      ['DEMO-0413', 'استلام شحنة طابوق جمهوري للبلوك 4', 'الإنشاء والمواقع', 'ameer@demo.abraj', 'haider@demo.abraj', 'pending', 'high', 3],
      ['DEMO-0416', 'تركيب أسيجة البلوك 2 — مجمع القضاة الديوانية', 'الإنشاء والمواقع', 'mustafa@demo.abraj', 'haider@demo.abraj', 'in_progress', 'high', 3],
      ['DEMO-0410', 'متابعة 14 قسطاً متأخراً — مجمع الرئاسة', 'المبيعات والتسويق', 'ali@demo.abraj', 'zainab@demo.abraj', 'in_progress', 'high', 4],
      ['DEMO-0401', 'فحص مكعبات خرسانة الدفعة 118', 'الهندسة والمختبر', 'ahmed@demo.abraj', 'abbas@demo.abraj', 'in_progress', 'high', -1],
      ['DEMO-0409', 'إعداد مسيّر رواتب الشهر', 'الإدارة والمالية', 'fatima@demo.abraj', 'fatima@demo.abraj', 'pending', 'critical', 1],
    ];
    for (const [code, title, d, assignee, reviewer, status, priority, due] of tasks) {
      await prisma.task.create({
        data: { code, title, departmentId: dept[d], creatorId: user[reviewer], assigneeId: user[assignee], reviewerId: user[reviewer], statusId: st[status], priorityId: pr[priority], dueDate: day(due) },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Demo data ready — ${people.length} demo logins (password: ${process.env.DEMO_PASSWORD ? '(DEMO_PASSWORD)' : 'Demo@2026!'})`);
}
