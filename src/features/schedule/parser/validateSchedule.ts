import type { ParsedShift, ScheduleNormalized, ScheduleValidationIssue } from './types'

type ShiftValidationContext = {
  rowIndex?: number
  colIndex?: number
  dayNumber?: number
  rawShift: string
}

function issue(base: {
  severity?: ScheduleValidationIssue['severity']
  code: string
  message: string
  rowIndex?: number
  colIndex?: number
  dayNumber?: number
  rawShift: string
}): ScheduleValidationIssue {
  return {
    severity: base.severity ?? 'warning',
    code: base.code,
    message: base.message,
    rowIndex: base.rowIndex,
    colIndex: base.colIndex,
    dayNumber: base.dayNumber,
    raw: base.rawShift,
  }
}

export function validateParsedShift(shift: ParsedShift, ctx: ShiftValidationContext): ScheduleValidationIssue[] {
  const issues: ScheduleValidationIssue[] = []
  const startHour = shift.startHM.hours
  const endHour = shift.endHM.hours

  // Keep validation intentionally "soft" (warnings), because Excel sources can vary.
  if (shift.kind === 'day') {
    const expectedEndHour = startHour + 12
    if (shift.durationMinutes !== 12 * 60) {
      issues.push(
        issue({
          severity: 'warning',
          code: 'DAY_SHIFT_DURATION_NOT_12H',
          message: `Нестандартная длительность дневной смены (${shift.durationMinutes / 60}ч), ожидалось 12ч`,
          ...ctx,
          rawShift: ctx.rawShift,
        }),
      )
    }
    if (endHour !== expectedEndHour) {
      issues.push(
        issue({
          severity: 'warning',
          code: 'DAY_SHIFT_END_NOT_STANDARD',
          message: `Конец дневной смены не совпадает с шаблоном: ожидалось ${expectedEndHour}:00/30, получено ${shift.end}`,
          ...ctx,
          rawShift: ctx.rawShift,
        }),
      )
    }
  } else if (shift.kind === 'night') {
    const expectedEndHour = startHour - 12
    if (shift.durationMinutes !== 12 * 60) {
      issues.push(
        issue({
          severity: 'warning',
          code: 'NIGHT_SHIFT_DURATION_NOT_12H',
          message: `Нестандартная длительность ночной смены (${shift.durationMinutes / 60}ч), ожидалось 12ч`,
          ...ctx,
          rawShift: ctx.rawShift,
        }),
      )
    }
    if (endHour !== expectedEndHour) {
      issues.push(
        issue({
          severity: 'warning',
          code: 'NIGHT_SHIFT_END_NOT_STANDARD',
          message: `Конец ночной смены не совпадает с шаблоном: ожидалось ${expectedEndHour}:00/30, получено ${shift.end}`,
          ...ctx,
          rawShift: ctx.rawShift,
        }),
      )
    }
  } else {
    // 24h-type
    if (shift.durationMinutes !== 24 * 60) {
      issues.push(
        issue({
          severity: 'warning',
          code: '24H_SHIFT_DURATION_NOT_24H',
          message: `Смена помечена как суточная, но длительность не 24ч (${shift.durationMinutes / 60}ч)`,
          ...ctx,
          rawShift: ctx.rawShift,
        }),
      )
    }
    if (endHour !== startHour && endHour !== startHour - 1) {
      issues.push(
        issue({
          severity: 'warning',
          code: '24H_SHIFT_END_NOT_EXPECTED',
          message: `Неожиданное окончание суточной смены: ожидалось ${startHour}:00/30 или ${startHour - 1}:00/30, получено ${shift.end}`,
          ...ctx,
          rawShift: ctx.rawShift,
        }),
      )
    }
  }

  if (shift.appendUntilText) {
    issues.push(
      issue({
        severity: 'warning',
        code: 'SHIFT_APPEND_UNTIL_REQUIRED',
        message: `Для корректной текстовой разметки требуется "до ${shift.end}"`,
        ...ctx,
        rawShift: ctx.rawShift,
      }),
    )
  }

  return issues
}

export function validateScheduleNormalized(normalized: ScheduleNormalized): ScheduleValidationIssue[] {
  const issues: ScheduleValidationIssue[] = []

  if (!normalized.meta.dayColumns.length) {
    issues.push({
      severity: 'error',
      code: 'NO_DAY_COLUMNS',
      message: 'Не удалось найти колонки с днями (1..31) в таблице графика.',
    })
  }

  if (normalized.employees.length === 0) {
    issues.push({
      severity: 'error',
      code: 'NO_EMPLOYEES',
      message: 'Не найдено ни одной строки сотрудника.',
    })
  }

  for (const e of normalized.employees) {
    if (!e.fullName.trim()) {
      issues.push({
        severity: 'error',
        code: 'EMPTY_FIO',
        message: 'Обнаружена строка сотрудника без ФИО.',
      })
    }
    if (!e.roleLabel.trim()) {
      issues.push({
        severity: 'warning',
        code: 'MISSING_ROLE',
        message: `Для сотрудника "${e.fullName}" не указана должность.`,
      })
    }
  }

  return issues
}

