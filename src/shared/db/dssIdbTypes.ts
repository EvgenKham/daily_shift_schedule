import type { DBSchema } from 'idb'

export type BrigadeType = 'bit' | 'pediatric' | 'linear' | 'transport'
export type StartTime = '7:00' | '7:30' | '8:00' | '8:30' | '9:00'

export type BrigadeSettings = {
  number: string
  type: BrigadeType
  startTime: StartTime
}

// --- IndexedDB document types ---

export type SettingsDoc = {
  /**
   * Singleton key inside `settings` store.
   * Kept as a field to allow `keyPath: 'id'`.
   */
  id: 'settings'
  userName: string
  substationNumber: number | null
  chiefParamedicName: string
  headOfSubstationName: string
  brigades: BrigadeSettings[]
  colorsByBrigadeType: Record<BrigadeType, string>
  createdAt: number
  updatedAt: number
  version: 1
}

export type ScheduleDoc = {
  /**
   * Stable key inside `schedules` store.
   * Format: `YYYY-MM`
   */
  scheduleMonthKey: string

  uploadedAt: number
  sourceName?: string

  /**
   * Raw/normalized data are both stored so we can re-validate/re-export
   * once the parser stabilizes.
   */
  raw: unknown
  normalized: unknown
}

export type RosterDoc = {
  /**
   * Primary key inside `rosters` store.
   */
  rosterId: string

  /**
   * YYYY-MM-DD
   */
  dateKey: string

  /**
   * YYYY-MM
   */
  scheduleMonthKey: string

  createdAt: number
  updatedAt: number

  /**
   * Table model that later will be exported to XLSX.
   * For now we keep it flexible until the generator/table model is introduced.
   */
  model: unknown
}

export type BindingDoc = {
  /**
   * Primary key.
   * This will become the "one-to-one binding" between schedule employees and roster employees.
   */
  bindingId: string
  createdAt: number
  updatedAt: number

  employee: unknown
  preferences: unknown
}

export const DSS_DB_NAME = 'daily_shift_schedule_db'
export const DSS_DB_VERSION = 1

export const SETTINGS_STORE = 'settings'
export const SCHEDULES_STORE = 'schedules'
export const ROSTERS_STORE = 'rosters'
export const BINDINGS_STORE = 'bindings'

export function getRosterId(dateKey: string, scheduleMonthKey: string) {
  return `${dateKey}__${scheduleMonthKey}`
}

export interface DssDbSchema extends DBSchema {
  settings: {
    key: SettingsDoc['id']
    value: SettingsDoc
  }

  schedules: {
    key: ScheduleDoc['scheduleMonthKey']
    value: ScheduleDoc
    indexes: {
      byUploadedAt: number
    }
  }

  rosters: {
    key: RosterDoc['rosterId']
    value: RosterDoc
    indexes: {
      byDateKey: string
      byScheduleMonthKey: string
    }
  }

  bindings: {
    key: BindingDoc['bindingId']
    value: BindingDoc
  }
}

