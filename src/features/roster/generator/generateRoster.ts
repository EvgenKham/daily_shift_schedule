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
 * Типы сотрудников согласно алгоритму
 */
type EmployeeType =
  | 'doctor' // Врач выездной бригады
  | 'doctor_pediatric' // Врач педиатр
  | 'doctor_psychiatrist' // Врач психиатр
  | 'paramedic_independent' // Фельдшер выезжающий самостоятельно
  | 'paramedic' // Фельдшер выездной бригады
  | 'dispatcher' // Диспетчер
  | 'paramedic_fill_block' // Фельдшер заправочного блока
  | 'cleaner_office' // Уборщик служебных помещений
  | 'cleaner_territory' // Уборщик территорий
  | 'sanitar' // Санитар выездной бригады
  | 'other' // Остальные

/**
 * Требования к бригадам по составу
 * Полный состав для каждой бригады
 */
const BRIGADE_REQUIREMENTS: Record<BrigadeType, {
  doctors: number
  paramedics: number
  paramedicsIndependent: number
  sanitars: number
}> = {
  bit: { doctors: 1, paramedics: 2, paramedicsIndependent: 0, sanitars: 1 },
  pediatric: { doctors: 1, paramedics: 1, paramedicsIndependent: 0, sanitars: 0 },
  linear: { doctors: 0, paramedics: 1, paramedicsIndependent: 1, sanitars: 0 },
  transport: { doctors: 0, paramedics: 1, paramedicsIndependent: 0, sanitars: 0 },
}

/**
 * Приоритеты сортировки сотрудников для разных типов бригад
 * - Во врачебных бригадах (БИТ, педиатрическая): врач → фельдшер → санитар
 * - В линейных бригадах: фельдшер выезжающий самостоятельно → фельдшер → санитар
 */
function getEmployeePriority(brigadeType: BrigadeType): Record<EmployeeType, number> {
  if (brigadeType === 'linear') {
    // Линейная бригада: фельдшер выезжающий самостоятельно → фельдшер → санитар
    return {
      paramedic_independent: 1,
      paramedic: 2,
      sanitar: 3,
      doctor: 99,
      doctor_pediatric: 99,
      doctor_psychiatrist: 99,
      dispatcher: 999,
      paramedic_fill_block: 999,
      cleaner_office: 999,
      cleaner_territory: 999,
      other: 999,
    }
  }
  // Врачебные бригады (БИТ, педиатрическая) и остальные: врач → фельдшер → санитар
  return {
    doctor: 1,
    doctor_pediatric: 1,
    doctor_psychiatrist: 1,
    paramedic_independent: 2,
    paramedic: 2,
    sanitar: 3,
    dispatcher: 999,
    paramedic_fill_block: 999,
    cleaner_office: 999,
    cleaner_territory: 999,
    other: 999,
  }
}

/**
 * Расширенное распределение сотрудников по бригадам
 * Согласно требованиям:
 * - Врач выездной бригады может быть только в БИТ
 * - Врач педиатр – только в педиатрической бригаде
 * - Фельдшер выезжающий самостоятельно – только в линейной бригаде
 * - Фельдшер выездной бригады может и должен быть в составе любой бригады
 * - Санитар может быть в любой бригаде, но не может быть один
 * - Санитар в приоритете на врачебной бригаде (БИТ, педиатрическая)
 * - Не более одного санитара на бригаду
 * - В одной бригаде не может быть 2 фельдшера выезжающих самостоятельно
 * - В одной бригаде не может быть только фельдшер выездной бригады и только санитар
 *   (требуется старший: врач, педиатр или фельдшер выезжающий самостоятельно)
 *
 * @param employees - Сотрудники для распределения
 * @param brigadeType - Тип бригады
 * @param _brigadeNumber - Номер бригады (не используется)
 * @param isNightShift - Ночная ли смена (резерв для будущей логики)
 */
function assignEmployeesToBrigadeAdvanced(
  employees: (Employee & { type: EmployeeType })[],
  brigadeType: BrigadeType,
  _brigadeNumber: string,
): (Employee & { type: EmployeeType })[] {
  const requirements = BRIGADE_REQUIREMENTS[brigadeType]
  const assigned: (Employee & { type: EmployeeType })[] = []

  // Сортируем сотрудников по должности перед распределением
  const sortedEmployees = [...employees].sort((a, b) => {
    const priority = getEmployeePriority(brigadeType)
    const priorityA = priority[a.type] ?? 999
    const priorityB = priority[b.type] ?? 999
    return priorityA - priorityB
  })

  // Создаём копии массивов для каждого типа сотрудников из отсортированного списка
  const available = {
    doctors: sortedEmployees.filter(e => e.type === 'doctor'),
    doctorsPediatric: sortedEmployees.filter(e => e.type === 'doctor_pediatric'),
    paramedicsIndependent: sortedEmployees.filter(e => e.type === 'paramedic_independent'),
    paramedics: sortedEmployees.filter(e => e.type === 'paramedic'),
    sanitars: sortedEmployees.filter(e => e.type === 'sanitar'),
  }

  // 1. Распределяем врачей согласно типу бригады
  if (brigadeType === 'bit' && requirements.doctors > 0) {
    const doctorsNeeded = requirements.doctors
    for (let i = 0; i < Math.min(doctorsNeeded, available.doctors.length); i++) {
      assigned.push(available.doctors[i])
    }
  }

  if (brigadeType === 'pediatric' && requirements.doctors > 0) {
    const doctorsNeeded = requirements.doctors
    for (let i = 0; i < Math.min(doctorsNeeded, available.doctorsPediatric.length); i++) {
      assigned.push(available.doctorsPediatric[i])
    }
  }

  // 2. Распределяем фельдшеров выезжающих самостоятельно (только для линейных)
  // ВАЖНО: не более 1 фельдшера выезжающего самостоятельно на бригаду
  if (brigadeType === 'linear' && requirements.paramedicsIndependent > 0) {
    const independentNeeded = Math.min(1, requirements.paramedicsIndependent) // Максимум 1
    for (let i = 0; i < Math.min(independentNeeded, available.paramedicsIndependent.length); i++) {
      assigned.push(available.paramedicsIndependent[i])
    }
  }

  // 3. Распределяем фельдшеров выездных бригад
  // Фельдшер выездной бригады может и должен быть в любой бригаде
  if (requirements.paramedics > 0) {
    const paramedicsNeeded = requirements.paramedics
    const stillNeeded = paramedicsNeeded - assigned.filter(e => e.type === 'paramedic').length

    for (let i = 0; i < Math.min(stillNeeded, available.paramedics.length); i++) {
      if (!assigned.includes(available.paramedics[i])) {
        assigned.push(available.paramedics[i])
      }
    }
  }

  // 4. Распределяем санитаров с проверками
  // - Санитар не может быть один (нужен врач или фельдшер выезжающий самостоятельно)
  // - Не более 1 санитара на бригаду
  // - В приоритете на врачебной бригаде (БИТ, педиатрическая)
  // - В бригаде не может быть ТОЛЬКО фельдшер выездной бригады и санитар (нужен старший)
  // Это требование действует и для дневной, и для ночной смены
  const hasSeniorStaff = assigned.some(e =>
    e.type === 'doctor' ||
    e.type === 'doctor_pediatric' ||
    e.type === 'paramedic_independent'
  )

  if (requirements.sanitars > 0 && hasSeniorStaff && available.sanitars.length > 0) {
    // Проверка: в бригаде не может быть ТОЛЬКО фельдшер выездной бригады и санитар
    // Нужен хотя бы один старший сотрудник (врач, педиатр, фельдшер выезжающий самостоятельно)
    const hasOnlyParamedic = assigned.some(e => e.type === 'paramedic') &&
      !assigned.some(e => e.type === 'doctor' || e.type === 'doctor_pediatric' || e.type === 'paramedic_independent')

    if (!hasOnlyParamedic) {
      // Добавляем только одного санитара
      assigned.push(available.sanitars[0])
    }
    // Если есть только фельдшер выездной бригады и нет старшего - санитара не добавляем
    // Это требование действует и для дневной, и для ночной смены
  }

  return assigned
}

/**
 * Generate roster data for a specific date from schedule + brigades settings.
 */
export function generateRoster(
  schedule: ScheduleNormalized,
  options: RosterGeneratorOptions,
): RosterData {
  const { dayNumber, brigades, settings } = options
  const warnings: RosterWarning[] = []

  // console.log(schedule);

  // Extract employees working on this day
  const employeesOnDay = schedule.employees
    .map((emp) => {
      const shiftCell = emp.shiftsByDay[dayNumber]
      if (!shiftCell || !shiftCell.parsed) return null

      return {
        fullName: emp.fullName,
        roleLabel: emp.roleLabel,
        shift: shiftCell.parsed,
        type: classifyEmployee(emp.roleLabel),
      } as Employee & { type: EmployeeType }
    })
    .filter((e): e is Employee & { type: EmployeeType } => e !== null)

  // Debug: count employees by type
  const typeCounts: Record<EmployeeType, number> = {
    doctor: 0,
    doctor_pediatric: 0,
    doctor_psychiatrist: 0,
    paramedic_independent: 0,
    paramedic: 0,
    sanitar: 0,
    dispatcher: 0,
    paramedic_fill_block: 0,
    cleaner_office: 0,
    cleaner_territory: 0,
    other: 0,
  }
  employeesOnDay.forEach(e => typeCounts[e.type]++)

  // console.log(employeesOnDay);

  // Add debug warning if no paramedics found
  // if (typeCounts.paramedic === 0 && typeCounts.doctor === 0 && typeCounts.doctor_pediatric === 0) {
  //   warnings.push({
  //     code: 'NO_MEDICAL_STAFF',
  //     message: `Найдено сотрудников: врачей=${typeCounts.doctor}, педиатров=${typeCounts.doctor_pediatric}, фельдшеров=${typeCounts.paramedic}. Проверьте график и классификацию должностей.`,
  //     severity: 'warning',
  //   })
  // }

  // Распределяем сотрудников по сменам на основе времени НАЧАЛА смены:
  // - Day сотрудники (start: 7:00, 7:30, 8:00, 9:00) → в dayEmployees
  // - Night сотрудники (start: 19:00, 19:30, 20:00, 21:00) → в nightEmployees
  // Суточные (duration > 12h) попадают в тот список, который соответствует времени начала их смены
  const DAY_START_TIMES = ['7:00', '7:30', '8:00', '9:00']
  const NIGHT_START_TIMES = ['19:00', '19:30', '20:00', '21:00']

  let dayEmployees = employeesOnDay.filter((e) => {
    if (!e.shift) return false
    return DAY_START_TIMES.includes(e.shift.start)
  })

  let nightEmployees = employeesOnDay.filter((e) => {
    if (!e.shift) return false
    // Сотрудники работающие 24 часа (суточные) попадают в обе смены
    const is24Hour = e.shift.durationMinutes > 12 * 60
    // Плюс сотрудники, начинающие работу в ночное время
    const isNightStart = NIGHT_START_TIMES.includes(e.shift.start)
    return isNightStart || is24Hour
  })

  // Generate brigade rows with proper employee assignment
  const brigadeRows: BrigadeRow[] = []

  // Распределяем сотрудников по порядку приоритета:
  // 1. Врачи
  // 2. Педиатры
  // 3. Фельдшеры выезжающие самостоятельно
  // 4. Фельдшеры выездных бригад
  // 5. Санитары
  // 6. Остальные

  for (const brigade of brigades) {
    const shiftDay = formatShiftDay(brigade.startTime)
    const shiftNight = formatShiftNight(brigade.startTime)

    // Фильтруем дневных сотрудников по времени начала смены
    const dayEmployeesForBrigade = dayEmployees.filter((e) => {
      if (!e.shift) return false
      return e.shift.start === brigade.startTime
    })

    // Ночные сотрудники для бригады (ТОЛЬКО не-суточные, начинающие в ночное время)
    // Суточные будут добавлены отдельно из assignedDay
    const nightStartTime = calculateNightStartTime(brigade.startTime)
    const nightEmployeesForBrigade = nightEmployees.filter((e) => {
      if (!e.shift) return false
      // Исключаем суточных — они будут добавлены из assignedDay
      const is24Hour = e.shift.durationMinutes > 12 * 60
      if (is24Hour) return false
      // Только сотрудники, начинающие работу в ночное время этой бригады
      return e.shift.start === nightStartTime
    })

    const assignedDay = assignEmployeesToBrigadeAdvanced(
      dayEmployeesForBrigade,
      brigade.type,
      brigade.number,
    )

    // Базовая ночная смена (не-суточные)
    const assignedNightBase = assignEmployeesToBrigadeAdvanced(
      nightEmployeesForBrigade,
      brigade.type,
      brigade.number,
    )

    // Добавляем суточных сотрудников из дневной смены той же бригады
    const employees24h = assignedDay.filter(e => e.shift && e.shift.durationMinutes > 12 * 60)
    const assignedNight = [...assignedNightBase, ...employees24h]

    // Удаляем распределённых сотрудников из пула
    const assignedDayKeys = new Set(assignedDay.map(e => e.fullName))
    const assignedNightKeys = new Set(assignedNight.map(e => e.fullName))

    dayEmployees = dayEmployees.filter(e => !assignedDayKeys.has(e.fullName))
    nightEmployees = nightEmployees.filter(e => !assignedNightKeys.has(e.fullName))

    brigadeRows.push({
      key: `brigade-${brigade.number}`,
      brigadeNumber: brigade.number,
      brigadeType: brigade.type,
      shiftDay,
      shiftNight,
      employeesDay: assignedDay,
      employeesNight: assignedNight,
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
 * Классификация сотрудника по роли
 * Поддерживает полные названия и сокращения из графика
 */
function classifyEmployee(roleLabel: string): EmployeeType {
  const role = roleLabel.toLowerCase()

  // Врач педиатр - только в педиатрической бригаде
  if (role.includes('педиатр') || role.includes('детский')) {
    return 'doctor_pediatric'
  }

  // Врач психиатр - только в психиатрической бригаде
  if (role.includes('психиатр')) {
    return 'doctor_psychiatrist'
  }

  // Фельдшер выезжающий самостоятельно - старший в линейной бригаде
  // Сокращения: "фельд. выез. сам.", "фельд. выезж. сам."
  if (role.includes('фельд') && role.includes('выез') && role.includes('сам')) {
    return 'paramedic_independent'
  }
  // Также проверяем "старший фельдшер"
  if (role.includes('старш') && role.includes('фельд')) {
    return 'paramedic_independent'
  }

  // Фельдшер выездной бригады
  // Сокращения: "фельд. выез. бр.", "фельд. выезд. бр."
  if (role.includes('фельд') && role.includes('выез') && role.includes('бр')) {
    return 'paramedic'
  }

  // Врач выездной бригады (проверяем после фельдшеров, чтобы не захватить их)
  // Сокращения: "врач выезд. бр.", "врач выездной"
  if (role.includes('врач') && role.includes('выез')) {
    return 'doctor'
  }
  if (role.includes('врач') && !role.includes('педиатр') && !role.includes('психиатр')) {
    return 'doctor'
  }

  // Санитар выездной бригады
  // Сокращения: "сан. выезд. бр.", "санитар выезд."
  if (role.includes('сан')) {
    return 'sanitar'
  }

  // Диспетчер
  if (role.includes('диспетчер')) {
    return 'dispatcher'
  }

  // Фельдшер заправочного блока
  if (role.includes('фельд') && (role.includes('заправ') && role.includes('блок'))) {
    return 'paramedic_fill_block'
  }

  // Уборщик служебных помещений
  if (role.includes('уборщ') && role.includes('помещ')) {
    return 'cleaner_office'
  }

  // Уборщик территорий
  if (role.includes('уборщ') && role.includes('террит')) {
    return 'cleaner_territory'
  }

  return 'other'
}

/**
 * Расчёт времени начала ночной смены на основе времени старта бригады
 * Например: 8:00 → 20:00, 9:00 → 21:00, 7:30 → 19:30
 */
function calculateNightStartTime(dayStartTime: string): string {
  const [hours, minutes] = dayStartTime.split(':').map(Number)
  const nightHours = hours + 12
  return `${String(nightHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/**
 * Generate support services from employees.
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
