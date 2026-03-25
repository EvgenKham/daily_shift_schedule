import type { ScheduleNormalized } from '../../schedule/parser/types'
import type { RosterData, RosterEmployee, RosterRow, RosterWarning, RosterGeneratorOptions } from './types'

/**
 * Generate roster data for a specific date from schedule + brigades settings.
 */
export function generateRoster(
  schedule: ScheduleNormalized,
  options: RosterGeneratorOptions,
): RosterData {
  const { dayNumber, brigades } = options
  const warnings: RosterWarning[] = []

  // Extract employees working on this day
  const employeesOnDay = schedule.employees
    .map((emp) => {
      const shiftCell = emp.shiftsByDay[dayNumber]
      if (!shiftCell || !shiftCell.parsed) return null

      return {
        fullName: emp.fullName,
        roleLabel: emp.roleLabel,
        shift: shiftCell.parsed,
      } as RosterEmployee
    })
    .filter((e): e is RosterEmployee => e !== null)

  // Separate by shift type
  const dayShiftEmployees = employeesOnDay.filter(
    (e) => e.shift && (e.shift.kind === 'day' || e.shift.kind === '24h'),
  )
  const nightShiftEmployees = employeesOnDay.filter(
    (e) => e.shift && (e.shift.kind === 'night' || e.shift.kind === '24h'),
  )

  // Generate rows for day and night shifts
  const rows: RosterRow[] = []

  // Day shift rows
  for (const brigade of brigades) {
    rows.push({
      key: `day-${brigade.brigadeNumber}`,
      brigade,
      shiftType: 'day',
      employees: assignEmployeesToBrigade(dayShiftEmployees, brigade),
    })
  }

  // Night shift rows
  for (const brigade of brigades) {
    rows.push({
      key: `night-${brigade.brigadeNumber}`,
      brigade,
      shiftType: 'night',
      employees: assignEmployeesToBrigade(nightShiftEmployees, brigade),
    })
  }

  // Check for empty brigades
  for (const row of rows) {
    if (row.employees.length === 0) {
      warnings.push({
        code: 'EMPTY_BRIGADE',
        message: `Бригада ${row.brigade.brigadeNumber} (${row.shiftType === 'day' ? 'день' : 'ночь'}): нет сотрудников`,
        severity: 'warning',
      })
    }
  }

  // Check for employees without role
  for (const emp of employeesOnDay) {
    if (!emp.roleLabel.trim()) {
      warnings.push({
        code: 'MISSING_ROLE',
        message: `Сотрудник "${emp.fullName}" не имеет указанной должности`,
        severity: 'warning',
      })
    }
  }

  return {
    dateKey: '', // Will be set by caller
    scheduleMonthKey: schedule.meta.sheetName,
    rows,
    warnings,
  }
}

/**
 * Assign employees to a brigade based on role matching heuristics.
 * For MVP: simple round-robin assignment.
 */
function assignEmployeesToBrigade(
  employees: RosterEmployee[],
  _brigade: { brigadeNumber: string },
): RosterEmployee[] {
  // MVP: return all employees for now
  // TODO: implement smart assignment based on role/brigade type
  return employees
}
