export type ShiftKind = 'day' | 'night' | '24h'

export type TimeHM = {
  hours: number
  minutes: number
}

export type ParsedShift = {
  raw: string
  startHM: TimeHM
  endHM: TimeHM
  start: string // `H:MM`
  end: string // `H:MM`
  kind: ShiftKind
  durationMinutes: number
  /**
   * Испоьзуется для нестандартных смен:
   * - если длительность > 12ч (кроме "классических" 24ч, когда start==end)
   * - если длительность < 12ч для day/night
   */
  //TODO Подумать как реализовать. У Сидорова "до 12.30", у Иванова "c 12.30" ?????
  // Пример: Сидоров работает 8\12.30, Иванов 12.30\8
  appendUntilText?: string
}

export type ShiftCell = {
  raw: string
  parsed?: ParsedShift
}

export type ScheduleEmployee = {
  fullName: string
  roleLabel: string
  shiftsByDay: Record<number, ShiftCell | undefined>
}

export type ScheduleNormalized = {
  employees: ScheduleEmployee[]
  meta: {
    sheetName: string
    parsedSheetNames: string[]
    headerRowIndex: number
    dayColumns: Array<{ colIndex: number; dayNumber: number }>
    employeeColumnIndices: {
      fio: number
      role: number
    }
  }
}

export type ScheduleValidationSeverity = 'error' | 'warning'

export type ScheduleValidationIssue = {
  severity: ScheduleValidationSeverity
  code: string
  message: string
  rowIndex?: number
  colIndex?: number
  dayNumber?: number
  raw?: string
}

export type ScheduleParseResult = {
  /**
   * Keep the raw grid so we can debug parser changes later.
   * (Stored as `unknown` in IndexedDB.)
   */
  raw: unknown
  normalized: ScheduleNormalized
  issues: ScheduleValidationIssue[]
  stats: {
    employeeCount: number
    shiftCellCount: number
    parsedShiftCount: number
  }
}

