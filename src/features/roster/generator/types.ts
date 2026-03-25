import type { ParsedShift } from '../../schedule/parser/types'

export type RosterShiftType = 'day' | 'night'

export type RosterEmployee = {
  fullName: string
  roleLabel: string
  shift?: ParsedShift
}

export type RosterBrigade = {
  brigadeNumber: string
  brigadeType: 'bit' | 'pediatric' | 'linear' | 'transport'
  startTime: string
}

export type RosterRow = {
  key: string
  brigade: RosterBrigade
  shiftType: RosterShiftType
  employees: RosterEmployee[]
}

export type RosterData = {
  dateKey: string // YYYY-MM-DD
  scheduleMonthKey: string // YYYY-MM
  rows: RosterRow[]
  warnings: RosterWarning[]
}

export type RosterWarning = {
  code: string
  message: string
  severity: 'warning' | 'error'
}

export type RosterGeneratorOptions = {
  dayNumber: number
  brigades: RosterBrigade[]
}
