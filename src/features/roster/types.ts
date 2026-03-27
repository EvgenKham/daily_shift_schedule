import type { ParsedShift } from '../schedule/parser/types'

/**
 * Типы для страницы наряда (RosterPage)
 * Соответствуют структуре из docs/ROSTER_STRUCTURE.md
 */

// ============================================================================
// Общие типы
// ============================================================================

export type BrigadeType = 'bit' | 'pediatric' | 'linear' | 'transport'
export type ShiftType = 'day' | 'night'

export type Employee = {
  fullName: string
  roleLabel: string
  prefix?: string // 'С' (сутки), 'Д' (день), 'Н' (ночь)
  shift?: ParsedShift
}

// ============================================================================
// Страница 1: Выездные бригады
// ============================================================================

export type BrigadeRow = {
  key: string
  brigadeNumber: string
  brigadeType: BrigadeType
  shiftDay: string // '8\\20', '9\\21', etc.
  shiftNight: string // '20\\8', '21\\9', etc.
  employeesDay: Employee[]
  employeesNight: Employee[]
  arrivalTimeDay?: string
  arrivalTimeNight?: string
}

// ============================================================================
// Страница 2: Вспомогательные службы
// ============================================================================

export type SupportServiceName =
  | 'DISPATCHER' // ДИСПЕТЧЕРСКАЯ
  | 'FUEL_BLOCK' // ЗАПРАВОЧНЫЙ БЛОК
  | 'CLEANER_PREMISES' // УБОРЩИК ПОМЕЩЕНИЙ
  | 'CLEANER_TERRITORY' // УБОРЩИК ТЕРРИТОРИИ

export type SupportPosition = {
  key: string
  shiftDay: string
  shiftNight: string
  employeeDay?: Employee
  employeeNight?: Employee
  arrivalTimeDay?: string
  arrivalTimeNight?: string
}

export type SupportService = {
  name: SupportServiceName
  displayName: string
  positions: SupportPosition[]
}

// ============================================================================
// Данные наряда
// ============================================================================

export type RosterData = {
  dateKey: string // YYYY-MM-DD
  scheduleMonthKey: string // YYYY-MM
  brigades: BrigadeRow[]
  supportServices: SupportService[]
  notes: string[] // 5 строк примечаний
  doctorName: string // Врач СМП (из настроек)
  doctorSignature: string
  nurseName: string // Фельдшер (из настроек)
  nurseSignature: string
  warnings: RosterWarning[]
}

export type RosterWarning = {
  code: string
  message: string
  severity: 'warning' | 'error'
}

// ============================================================================
// Настройки для генерации
// ============================================================================

export type RosterGeneratorOptions = {
  dayNumber: number // день месяца (1-31)
  brigades: Array<{
    number: string
    type: BrigadeType
    startTime: string
  }>
  settings: {
    doctorName: string
    doctorSignature: string
    nurseName: string
    nurseSignature: string
  }
}

// ============================================================================
// Константы
// ============================================================================

export const SUPPORT_SERVICE_NAMES: Record<SupportServiceName, string> = {
  DISPATCHER: 'ДИСПЕТЧЕРСКАЯ',
  FUEL_BLOCK: 'ЗАПРАВОЧНЫЙ БЛОК',
  CLEANER_PREMISES: 'УБОРЩИК ПОМЕЩЕНИЙ (СЛУЖЕБНЫХ)',
  CLEANER_TERRITORY: 'УБОРЩИК ТЕРРИТОРИИ',
}

export const BRIGADE_TYPE_NAMES: Record<BrigadeType, string> = {
  bit: 'БИТ',
  pediatric: 'Пед',
  linear: 'Лин',
  transport: 'Перев',
}
