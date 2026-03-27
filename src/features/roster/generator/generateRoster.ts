import type { ScheduleNormalized } from '../../schedule/parser/types'
import type {
  BrigadeRow,
  RosterData,
  RosterGeneratorOptions,
  SupportService,
  Employee,
  RosterWarning,
  BrigadeType,
} from '../types'

/**
 * Generate roster data for a specific date from schedule + brigades settings.
 */
export function generateRoster(
  schedule: ScheduleNormalized,
  options: RosterGeneratorOptions,
): RosterData {
  const { dayNumber, brigades, settings } = options
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
      } as Employee
    })
    .filter((e): e is Employee => e !== null)

  // Separate by shift type (day/night)
  const dayEmployees = employeesOnDay.filter(
    (e) => e.shift && (e.shift.kind === 'day' || e.shift.kind === '24h'),
  )
  const nightEmployees = employeesOnDay.filter(
    (e) => e.shift && (e.shift.kind === 'night' || e.shift.kind === '24h'),
  )

  // Generate brigade rows
  const brigadeRows: BrigadeRow[] = []

  for (const brigade of brigades) {
    const shiftDay = formatShiftDay(brigade.startTime)
    const shiftNight = formatShiftNight(brigade.startTime)

    const employeesAssignedDay = assignEmployeesToBrigade(dayEmployees, brigade.type)
    const employeesAssignedNight = assignEmployeesToBrigade(nightEmployees, brigade.type)

    brigadeRows.push({
      key: `brigade-${brigade.number}`,
      brigadeNumber: brigade.number,
      brigadeType: brigade.type,
      shiftDay,
      shiftNight,
      employeesDay: employeesAssignedDay,
      employeesNight: employeesAssignedNight,
      arrivalTimeDay: formatArrivalTime(brigade.startTime),
      arrivalTimeNight: formatArrivalTimeNight(brigade.startTime),
    })
  }

  // Generate support services
  const supportServices: SupportService[] = generateSupportServices(employeesOnDay)

  // Check for warnings
  for (const row of brigadeRows) {
    if (row.employeesDay.length === 0) {
      warnings.push({
        code: 'EMPTY_BRIGADE_DAY',
        message: `Бригада ${row.brigadeNumber} (день): нет сотрудников`,
        severity: 'warning',
      })
    }
    if (row.employeesNight.length === 0) {
      warnings.push({
        code: 'EMPTY_BRIGADE_NIGHT',
        message: `Бригада ${row.brigadeNumber} (ночь): нет сотрудников`,
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
    brigades: brigadeRows,
    supportServices,
    notes: ['', '', '', '', ''], // 5 empty note lines
    doctorName: settings.doctorName,
    doctorSignature: settings.doctorSignature,
    nurseName: settings.nurseName,
    nurseSignature: settings.nurseSignature,
    warnings,
  }
}

/**
 * Assign employees to a brigade based on brigade type heuristics.
 * For MVP: filter by role label matching brigade type.
 */
function assignEmployeesToBrigade(employees: Employee[], brigadeType: BrigadeType): Employee[] {
  // Simple heuristic: match role label to brigade type
  const typeKeywords: Record<BrigadeType, string[]> = {
    bit: ['бит', 'бригада', 'врач', 'фельдшер'],
    pediatric: ['пед', 'детский', 'педиатр'],
    linear: ['лин', 'линейн'],
    transport: ['перев', 'транспорт'],
  }

  const keywords = typeKeywords[brigadeType]

  return employees.filter((emp) => {
    const roleLower = emp.roleLabel.toLowerCase()
    const nameLower = emp.fullName.toLowerCase()
    return keywords.some((kw) => roleLower.includes(kw) || nameLower.includes(kw))
  })
}

/**
 * Generate support services from employees.
 * For MVP: extract based on role keywords.
 */
function generateSupportServices(employees: Employee[]): SupportService[] {
  const services: SupportService[] = []

  // Helper to find employees by keyword
  const findByKeyword = (keywords: string[]): Employee[] => {
    return employees.filter((emp) => {
      const roleLower = emp.roleLabel.toLowerCase()
      return keywords.some((kw) => roleLower.includes(kw))
    })
  }

  // ДИСПЕТЧЕРСКАЯ
  const dispatchers = findByKeyword(['диспетчер', 'д '])
  if (dispatchers.length > 0) {
    services.push({
      name: 'DISPATCHER',
      displayName: 'ДИСПЕТЧЕРСКАЯ',
      positions: [
        {
          key: 'dispatcher-1',
          shiftDay: '8\\20',
          shiftNight: '20\\8',
          employeeDay: dispatchers[0],
          employeeNight: dispatchers[1] || dispatchers[0],
          arrivalTimeDay: '8:00',
          arrivalTimeNight: '20:00',
        },
      ],
    })
  }

  // ЗАПРАВОЧНЫЙ БЛОК
  const fuelBlock = findByKeyword(['заправ', 'топлив'])
  if (fuelBlock.length > 0) {
    services.push({
      name: 'FUEL_BLOCK',
      displayName: 'ЗАПРАВОЧНЫЙ БЛОК',
      positions: [
        {
          key: 'fuel-1',
          shiftDay: '8\\20',
          shiftNight: '20\\8',
          employeeDay: fuelBlock[0],
          employeeNight: fuelBlock[0],
          arrivalTimeDay: '8:00',
          arrivalTimeNight: '20:00',
        },
      ],
    })
  }

  // УБОРЩИК ПОМЕЩЕНИЙ
  const cleanersPremises = findByKeyword(['уборщик помещ', 'уборщица помещ', 'уборщик служеб'])
  if (cleanersPremises.length > 0) {
    services.push({
      name: 'CLEANER_PREMISES',
      displayName: 'УБОРЩИК ПОМЕЩЕНИЙ (СЛУЖЕБНЫХ)',
      positions: cleanersPremises.slice(0, 4).map((emp, idx) => ({
        key: `cleaner-premises-${idx}`,
        shiftDay: '8\\16',
        shiftNight: '',
        employeeDay: emp,
        arrivalTimeDay: '8:00',
      })),
    })
  }

  // УБОРЩИК ТЕРРИТОРИИ
  const cleanersTerritory = findByKeyword(['уборщик террит', 'уборщица террит'])
  if (cleanersTerritory.length > 0) {
    services.push({
      name: 'CLEANER_TERRITORY',
      displayName: 'УБОРЩИК ТЕРРИТОРИИ',
      positions: [
        {
          key: 'cleaner-territory-1',
          shiftDay: '8\\15',
          shiftNight: '',
          employeeDay: cleanersTerritory[0],
          arrivalTimeDay: '8:00',
        },
      ],
    })
  }

  return services
}

function formatShiftDay(startTime: string): string {
  // Map start time to shift format
  const start = startTime.replace(':', '.')
  if (start === '7' || start === '7.00') return '7\\19'
  if (start === '7.30') return '7.30\\19.30'
  if (start === '8' || start === '8.00') return '8\\20'
  if (start === '8.30') return '8.30\\20.30'
  if (start === '9' || start === '9.00') return '9\\21'
  return '8\\20'
}

function formatShiftNight(startTime: string): string {
  const start = startTime.replace(':', '.')
  if (start === '7' || start === '7.00') return '19\\7'
  if (start === '7.30') return '19.30\\7.30'
  if (start === '8' || start === '8.00') return '20\\8'
  if (start === '8.30') return '20.30\\8.30'
  if (start === '9' || start === '9.00') return '21\\9'
  return '20\\8'
}

function formatArrivalTime(startTime: string): string {
  return startTime.includes(':') ? startTime : `${startTime}:00`
}

function formatArrivalTimeNight(startTime: string): string {
  const [hours] = startTime.split(':').map(Number)
  const endHours = hours + 12
  return `${String(endHours).padStart(2, '0')}:00`
}
