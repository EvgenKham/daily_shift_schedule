import * as XLSX from 'xlsx'
import type { ScheduleParseResult, ScheduleNormalized, ScheduleValidationIssue, ShiftCell } from './types'
import { parseShiftString } from './shiftParsing'
import { validateParsedShift, validateScheduleNormalized } from './validateSchedule'

type ParseScheduleXlsxOptions = {
  sheetName?: string
  sheetNames?: string[]
}

function toCellText(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v).trim()
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  return String(v).trim()
}

function isEmptyShiftToken(s: string) {
  const t = s.trim()
  return !t || t === '-' || t === '—' || t === '–' || t.toLowerCase() === 'нет'
}

function parseDayNumberFromCellText(s: string): number | null {
  const t = s.trim()
  if (!/^\d{1,2}$/.test(t)) return null
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  if (n < 1 || n > 31) return null
  return n
}

function findDaysHeaderRow(grid: unknown[][]): { headerRowIndex: number; dayColumns: Array<{ colIndex: number; dayNumber: number }> } | null {
  const rowCount = grid.length
  const colCount = Math.max(...grid.map((r) => r.length), 0)

  let best:
    | {
        headerRowIndex: number
        dayColumns: Array<{ colIndex: number; dayNumber: number }>
        score: number
      }
    | null = null

  for (let r = 0; r < rowCount; r++) {
    const candidates: Array<{ colIndex: number; dayNumber: number }> = []

    for (let c = 0; c < colCount; c++) {
      const text = toCellText(grid[r]?.[c])
      const dayNumber = parseDayNumberFromCellText(text)
      if (dayNumber == null) continue
      candidates.push({ colIndex: c, dayNumber })
    }

    if (candidates.length < 5) continue

    const dayNums = candidates.map((x) => x.dayNumber)
    const minDay = Math.min(...dayNums)
    const maxDay = Math.max(...dayNums)
    const span = maxDay - minDay + 1
    const score = candidates.length * 1000 + span

    if (!best || score > best.score) {
      best = { headerRowIndex: r, dayColumns: candidates.slice().sort((a, b) => a.colIndex - b.colIndex), score }
    }
  }

  if (!best) return null
  // Deduplicate by dayNumber, keeping left-most column for each day.
  const seen = new Set<number>()
  const deduped: Array<{ colIndex: number; dayNumber: number }> = []
  for (const dc of best.dayColumns) {
    if (seen.has(dc.dayNumber)) continue
    seen.add(dc.dayNumber)
    deduped.push(dc)
  }

  return { headerRowIndex: best.headerRowIndex, dayColumns: deduped }
}

function findEmployeeColumnIndices(grid: unknown[][], headerRowIndex: number, dayColumns: Array<{ colIndex: number; dayNumber: number }>) {
  const headerRow = grid[headerRowIndex] ?? []
  const dayStartCol = Math.min(...dayColumns.map((d) => d.colIndex))

  const fio = headerRow.findIndex((v) => {
    const t = toCellText(v).toLowerCase()
    return t.includes('фио')
  })

  const role = headerRow.findIndex((v) => {
    const t = toCellText(v).toLowerCase()
    return t.includes('долж')
  })

  // Heuristic fallback to the "last two columns before days".
  if (fio === -1 || role === -1 || fio >= dayStartCol || role >= dayStartCol) {
    const fallbackFio = dayStartCol - 2
    const fallbackRole = dayStartCol - 1
    return { fio: fallbackFio >= 0 ? fallbackFio : 0, role: fallbackRole >= 0 ? fallbackRole : 1 }
  }

  return { fio, role }
}

function createEmptyResult(): ScheduleParseResult {
  const normalized: ScheduleNormalized = {
    employees: [],
    meta: {
      sheetName: '',
      parsedSheetNames: [],
      headerRowIndex: -1,
      dayColumns: [],
      employeeColumnIndices: { fio: 0, role: 1 },
    },
  }

  return {
    raw: null,
    normalized,
    issues: [
      {
        severity: 'error',
        code: 'EMPTY_SCHEDULE',
        message: 'График не распознан.',
      },
    ],
    stats: { employeeCount: 0, shiftCellCount: 0, parsedShiftCount: 0 },
  }
}

type ParseWorksheetResult = {
  rawGrid: unknown[][]
  normalized: ScheduleNormalized
  issues: ScheduleValidationIssue[]
  stats: {
    employeeCount: number
    shiftCellCount: number
    parsedShiftCount: number
  }
}

function parseWorksheet(sheetName: string, worksheet: XLSX.WorkSheet): ParseWorksheetResult {
  const grid = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' }) as unknown[][]
  const maxCols = Math.max(...grid.map((r) => r.length), 0)
  const normalizedGrid: unknown[][] = grid.map((r) => {
    const row = r.slice(0, maxCols)
    while (row.length < maxCols) row.push('')
    return row
  })

  const headerFound = findDaysHeaderRow(normalizedGrid)
  if (!headerFound) {
    const normalized: ScheduleNormalized = {
      employees: [],
      meta: {
        sheetName,
        parsedSheetNames: [sheetName],
        headerRowIndex: -1,
        dayColumns: [],
        employeeColumnIndices: { fio: 0, role: 1 },
      },
    }
    const issues: ScheduleValidationIssue[] = [
      { severity: 'error', code: 'NO_DAYS_HEADER', message: `Лист "${sheetName}": не удалось найти строку заголовка с днями (1..31).` },
      ...validateScheduleNormalized(normalized),
    ]

    return {
      rawGrid: normalizedGrid,
      normalized,
      issues,
      stats: { employeeCount: 0, shiftCellCount: 0, parsedShiftCount: 0 },
    }
  }

  const { headerRowIndex, dayColumns } = headerFound
  const employeeColumnIndices = findEmployeeColumnIndices(normalizedGrid, headerRowIndex, dayColumns)

  const issues: ScheduleValidationIssue[] = []
  const employees: ScheduleNormalized['employees'] = []
  let shiftCellCount = 0
  let parsedShiftCount = 0

  // Parse employees row-by-row after the header.
  let consecutiveEmptyRows = 0
  for (let r = headerRowIndex + 1; r < normalizedGrid.length; r++) {
    const row = normalizedGrid[r]
    const fullName = toCellText(row?.[employeeColumnIndices.fio] ?? '').replace(/\s+/g, ' ')
    const roleLabel = toCellText(row?.[employeeColumnIndices.role] ?? '').replace(/\s+/g, ' ')

    const anyShift = dayColumns.some(({ colIndex }) => {
      const t = toCellText(row?.[colIndex])
      return !isEmptyShiftToken(t)
    })

    const anyText = !!fullName || !!roleLabel
    if (!anyText && !anyShift) {
      consecutiveEmptyRows++
      if (consecutiveEmptyRows >= 3) break
      continue
    }
    consecutiveEmptyRows = 0

    if (!fullName) {
      issues.push({
        severity: 'error',
        code: 'EMPTY_FIO',
        message: `Лист "${sheetName}": строка содержит данные смен, но ФИО пустое.`,
        rowIndex: r,
      })
      // Still continue parsing shifts to help debug, but we cannot create an employee row.
      if (anyShift) {
        for (const { colIndex, dayNumber } of dayColumns) {
          const rawShift = toCellText(row?.[colIndex] ?? '')
          if (isEmptyShiftToken(rawShift)) continue
          const parsed = parseShiftString(rawShift)
          if ('error' in parsed) {
            issues.push({
              severity: 'error',
              code: 'UNKNOWN_SHIFT_FORMAT',
              message: `Лист "${sheetName}": неизвестный формат смены "${rawShift}"`,
              rowIndex: r,
              colIndex,
              dayNumber,
              raw: rawShift,
            })
          }
        }
      }
      continue
    }

    if (!roleLabel) {
      issues.push({
        severity: 'warning',
        code: 'MISSING_ROLE',
        message: `Лист "${sheetName}": для сотрудника "${fullName}" не указана должность.`,
        rowIndex: r,
      })
    }

    const shiftsByDay: Record<number, ShiftCell | undefined> = {}
    for (const { colIndex, dayNumber } of dayColumns) {
      const rawShift = toCellText(row?.[colIndex] ?? '')
      if (isEmptyShiftToken(rawShift)) continue

      shiftCellCount++
      const parsed = parseShiftString(rawShift)
      if ('error' in parsed) {
        issues.push({
          severity: 'error',
          code: 'UNKNOWN_SHIFT_FORMAT',
          message: `Лист "${sheetName}": неизвестный формат смены "${rawShift}"`,
          rowIndex: r,
          colIndex,
          dayNumber,
          raw: rawShift,
        })
        shiftsByDay[dayNumber] = { raw: rawShift }
        continue
      }

      parsedShiftCount++
      shiftsByDay[dayNumber] = { raw: rawShift, parsed }

      const shiftIssues = validateParsedShift(parsed, {
        rowIndex: r,
        colIndex,
        dayNumber,
        rawShift,
      }).map((it) => ({
        ...it,
        message: `Лист "${sheetName}": ${it.message}`,
      }))
      issues.push(...shiftIssues)
    }

    employees.push({
      fullName,
      roleLabel,
      shiftsByDay,
    })
  }

  const normalized: ScheduleNormalized = {
    employees,
    meta: {
      sheetName,
      parsedSheetNames: [sheetName],
      headerRowIndex,
      dayColumns,
      employeeColumnIndices,
    },
  }

  const allIssues = [...issues, ...validateScheduleNormalized(normalized)]

  return {
    rawGrid: normalizedGrid,
    normalized,
    issues: allIssues,
    stats: {
      employeeCount: employees.length,
      shiftCellCount,
      parsedShiftCount,
    },
  }
}

export async function parseScheduleXlsx(arrayBuffer: ArrayBuffer, options?: ParseScheduleXlsxOptions): Promise<ScheduleParseResult> {
  try {
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellText: false })
    const requestedSheetNames = options?.sheetNames?.length
      ? options.sheetNames
      : options?.sheetName
        ? [options.sheetName]
        : workbook.SheetNames

    const sheetNames = requestedSheetNames.filter((n) => typeof n === 'string' && n.trim().length > 0)
    if (sheetNames.length === 0) return createEmptyResult()

    const allEmployees: ScheduleNormalized['employees'] = []
    const allIssues: ScheduleValidationIssue[] = []
    const rawBySheet: Record<string, unknown[][]> = {}
    let totalShiftCellCount = 0
    let totalParsedShiftCount = 0

    let baseMeta: ScheduleNormalized['meta'] | null = null
    const parsedSheetNames: string[] = []

    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName]
      if (!worksheet) {
        allIssues.push({
          severity: 'error',
          code: 'SHEET_NOT_FOUND',
          message: `Лист "${sheetName}" не найден в файле.`,
        })
        continue
      }

      const parsed = parseWorksheet(sheetName, worksheet)
      rawBySheet[sheetName] = parsed.rawGrid
      allEmployees.push(...parsed.normalized.employees)
      allIssues.push(...parsed.issues)
      totalShiftCellCount += parsed.stats.shiftCellCount
      totalParsedShiftCount += parsed.stats.parsedShiftCount
      parsedSheetNames.push(sheetName)

      if (!baseMeta) {
        baseMeta = parsed.normalized.meta
      }
    }

    const normalized: ScheduleNormalized = {
      employees: allEmployees,
      meta: {
        sheetName: parsedSheetNames.join(', '),
        parsedSheetNames,
        headerRowIndex: baseMeta?.headerRowIndex ?? -1,
        dayColumns: baseMeta?.dayColumns ?? [],
        employeeColumnIndices: baseMeta?.employeeColumnIndices ?? { fio: 0, role: 1 },
      },
    }

    const crossSheetValidation = validateScheduleNormalized(normalized)

    return {
      raw: rawBySheet,
      normalized,
      issues: [...allIssues, ...crossSheetValidation],
      stats: {
        employeeCount: allEmployees.length,
        shiftCellCount: totalShiftCellCount,
        parsedShiftCount: totalParsedShiftCount,
      },
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    const empty = createEmptyResult()
    return {
      ...empty,
      issues: [{ severity: 'error', code: 'XLSX_PARSE_FAILED', message, raw: undefined }],
    }
  }
}

export async function parseScheduleXlsxFile(file: File, options?: ParseScheduleXlsxOptions): Promise<ScheduleParseResult> {
  const arrayBuffer = await file.arrayBuffer()
  return parseScheduleXlsx(arrayBuffer, options)
}

