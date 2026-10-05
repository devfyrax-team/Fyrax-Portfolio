export interface Summary {
  workingDays: number;
  daysPresent: number;
  daysLate: number;
  halfDays: number;
  absentDays: number;
  holidays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  workedMinutes: number;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
  status: 'PRESENT' | 'LATE' | 'HALF_DAY';
  manual: boolean;
  source: 'PUNCH' | 'MANUAL' | 'REGULARIZATION' | 'OUT_ON_WORK';
}

// Shown next to the status when the record did not come from a normal check-in.
export const sourceNote: Record<AttendanceRecord['source'], string> = {
  PUNCH: '',
  MANUAL: 'corrected by HR',
  REGULARIZATION: 'regularised',
  OUT_ON_WORK: 'out on work',
};

export const hours = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;

export function SummaryStats({ s }: { s: Summary }) {
  // The tone marks state at a glance: green for presence, amber for lateness, red for absence.
  const items: [string, string | number, string?][] = [
    ['Working days', s.workingDays],
    ['Present', s.daysPresent, 'ok'],
    ['Late', s.daysLate, s.daysLate ? 'warn' : undefined],
    ['Half days', s.halfDays, s.halfDays ? 'warn' : undefined],
    ['Absent', s.absentDays, s.absentDays ? 'bad' : undefined],
    ['Paid leave', s.paidLeaveDays],
    ['Unpaid leave', s.unpaidLeaveDays],
    ['Holidays', s.holidays],
    ['Hours worked', hours(s.workedMinutes), 'accent'],
  ];
  return (
    <div className="stats">
      {items.map(([label, value, tone]) => (
        <div className={tone ? `stat ${tone}` : 'stat'} key={label}>
          <b>{value}</b>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
