import { buildPlan } from './bookings.service';

describe('buildPlan', () => {
  it('splits evenly and puts the remainder on the last installment', () => {
    const plan = buildPlan(100_000_001, 4, new Date(Date.UTC(2026, 11, 1)), 1);
    expect(plan.map((p) => p.amount)).toEqual([25_000_000, 25_000_000, 25_000_000, 25_000_001]);
    expect(plan.reduce((a, p) => a + p.amount, 0)).toBe(100_000_001);
  });

  it('steps due dates by the interval and rolls over the year', () => {
    const plan = buildPlan(300, 3, new Date(Date.UTC(2026, 10, 15)), 2);
    expect(plan.map((p) => p.dueDate.toISOString().slice(0, 10))).toEqual(['2026-11-15', '2027-01-15', '2027-03-15']);
  });
});
