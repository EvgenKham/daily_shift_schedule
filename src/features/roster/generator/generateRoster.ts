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
import { BRIGADE_TYPE_NAMES } from '../types'

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
  pediatric: { doctors: 1, paramedics: 1, paramedicsIndependent: 0, sanitars: 1 },
  linear: { doctors: 0, paramedics: 1, paramedicsIndependent: 1, sanitars: 1 },
  transport: { doctors: 0, paramedics: 1, paramedicsIndependent: 0, sanitars: 0 },
}

/**
 * Генерация номера бригады на основе подстанции и порядкового номера
 *
 * Логика:
 * - Формат: [подстанция][порядковый_номер]
 * - Для бригад без врача (линейная, перевозка): номера 60-69
 * - Если номер уже занят, продолжать последовательность
 */
function generateBrigadeNumber(
  substationNumber: number | null,
  brigadeType: BrigadeType,
  sequenceNumber: number,
  existingNumbers: Set<string>,
): string {
  const substation = substationNumber ?? 0

  // Для бригад без врача (линейная, перевозка) используем диапазон 60+
  const needs60Range = brigadeType === 'linear' || brigadeType === 'transport'

  if (needs60Range) {
    const baseNumber = 60 + sequenceNumber - 1

    // Проверяем, не занят ли номер, ищем свободный
    let candidate = baseNumber
    while (existingNumbers.has(`${substation}${candidate}`)) {
      candidate++
    }

    return `${substation}${candidate}`
  }

  // Для врачебных бригад используем обычный порядковый номер
  let candidate = sequenceNumber
  while (existingNumbers.has(`${substation}${candidate}`)) {
    candidate++
  }

  return `${substation}${candidate}`
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
 * @param alreadyAssigned - Уже назначенные сотрудники (например, суточные из дневной смены)
 */
function assignEmployeesToBrigadeAdvanced(
  employees: (Employee & { type: EmployeeType })[],
  brigadeType: BrigadeType,
  _brigadeNumber: string,
  alreadyAssigned: (Employee & { type: EmployeeType })[] = [],
): (Employee & { type: EmployeeType })[] {
  const requirements = BRIGADE_REQUIREMENTS[brigadeType]
  const assigned = [...alreadyAssigned]

  // Считаем сколько сотрудников каждого типа уже назначено
  const alreadyCount = {
    doctor: alreadyAssigned.filter(e => e.type === 'doctor').length,
    doctorPediatric: alreadyAssigned.filter(e => e.type === 'doctor_pediatric').length,
    paramedicIndependent: alreadyAssigned.filter(e => e.type === 'paramedic_independent').length,
    paramedic: alreadyAssigned.filter(e => e.type === 'paramedic').length,
    sanitar: alreadyAssigned.filter(e => e.type === 'sanitar').length,
  }

  // Сортируем сотрудников по должности перед распределением
  const sortedEmployees = [...employees].sort((a, b) => {
    const priority = getEmployeePriority(brigadeType)
    const priorityA = priority[a.type] ?? 999
    const priorityB = priority[b.type] ?? 999
    return priorityA - priorityB
  })

  // Создаём копии массивов для каждого типа сотрудников из отсортированного списка
  // Исключаем тех, кто уже назначен
  const alreadyAssignedNames = new Set(alreadyAssigned.map(e => e.fullName))
  const available = {
    doctors: sortedEmployees.filter(e => e.type === 'doctor' && !alreadyAssignedNames.has(e.fullName)),
    doctorsPediatric: sortedEmployees.filter(e => e.type === 'doctor_pediatric' && !alreadyAssignedNames.has(e.fullName)),
    paramedicsIndependent: sortedEmployees.filter(e => e.type === 'paramedic_independent' && !alreadyAssignedNames.has(e.fullName)),
    paramedics: sortedEmployees.filter(e => e.type === 'paramedic' && !alreadyAssignedNames.has(e.fullName)),
    sanitars: sortedEmployees.filter(e => e.type === 'sanitar' && !alreadyAssignedNames.has(e.fullName)),
  }

  // 1. Распределяем врачей согласно типу бригады (учитывая уже назначенных)
  if (brigadeType === 'bit' && requirements.doctors > 0) {
    const doctorsNeeded = requirements.doctors - alreadyCount.doctor
    for (let i = 0; i < Math.min(doctorsNeeded, available.doctors.length); i++) {
      assigned.push(available.doctors[i])
    }
  }

  if (brigadeType === 'pediatric' && requirements.doctors > 0) {
    const doctorsNeeded = requirements.doctors - alreadyCount.doctorPediatric
    for (let i = 0; i < Math.min(doctorsNeeded, available.doctorsPediatric.length); i++) {
      assigned.push(available.doctorsPediatric[i])
    }
  }

  // 2. Распределяем фельдшеров выезжающих самостоятельно (только для линейных)
  // ВАЖНО: не более 1 фельдшера выезжающего самостоятельно на бригаду
  if (brigadeType === 'linear' && requirements.paramedicsIndependent > 0) {
    const independentNeeded = Math.min(1, requirements.paramedicsIndependent) - alreadyCount.paramedicIndependent
    for (let i = 0; i < Math.min(independentNeeded, available.paramedicsIndependent.length); i++) {
      assigned.push(available.paramedicsIndependent[i])
    }
  }

  // 3. Распределяем фельдшеров выездных бригад
  // Фельдшер выездной бригады может и должен быть в любой бригаде
  if (requirements.paramedics > 0) {
    const paramedicsNeeded = requirements.paramedics - alreadyCount.paramedic
    for (let i = 0; i < Math.min(paramedicsNeeded, available.paramedics.length); i++) {
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

  if (requirements.sanitars > 0 && hasSeniorStaff && alreadyCount.sanitar === 0 && available.sanitars.length > 0) {
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
  const { dayNumber, brigades, settings, substationNumber } = options
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

  // Отслеживаем уже использованные номера бригад
  const usedBrigadeNumbers = new Set<string>()

  // Счётчики для последовательной нумерации по типам
  const typeSequenceCounters: Record<BrigadeType, number> = {
    bit: 0,
    pediatric: 0,
    linear: 0,
    transport: 0,
  }

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
      brigade.number ?? '',
    )

    // Суточные сотрудники из дневной смены — они уже назначены в ночную смену
    const employees24h = assignedDay.filter(e => e.shift && e.shift.durationMinutes > 12 * 60)

    // Ночная смена: учитываем суточных как уже назначенных, чтобы не было избытка
    const assignedNight = assignEmployeesToBrigadeAdvanced(
      nightEmployeesForBrigade,
      brigade.type,
      brigade.number ?? '',
      employees24h,
    ).sort((a, b) => {
      const priority = getEmployeePriority(brigade.type)
      const priorityA = priority[a.type] ?? 999
      const priorityB = priority[b.type] ?? 999
      return priorityA - priorityB
    })

    // Определяем тип бригады отдельно для ДНЯ и НОЧИ
    let finalBrigadeTypeDay = brigade.type
    let finalBrigadeTypeNight = brigade.type
    let finalBrigadeNumberDay: string
    let finalBrigadeNumberNight: string

    // Проверяем наличие врача в ДНЕВНОЙ и НОЧНОЙ сменах
    const hasDoctorDay = assignedDay.some(e =>
      e.type === 'doctor' || e.type === 'doctor_pediatric'
    )
    const hasDoctorNight = assignedNight.some(e =>
      e.type === 'doctor' || e.type === 'doctor_pediatric'
    )

    // Проверяем, нужно ли менять тип бригады
    // Меняем ТОЛЬКО если: врачебная бригада (БИТ/Пед) и нет врача
    const isMedicalBrigade = brigade.type === 'bit' || brigade.type === 'pediatric'

    // Определяем тип для ДНЕВНОЙ смены
    if (isMedicalBrigade && !hasDoctorDay) {
      const paramedicCountDay = assignedDay.filter(e => e.type === 'paramedic').length
      if (paramedicCountDay >= 2) {
        finalBrigadeTypeDay = 'linear'
      } else {
        finalBrigadeTypeDay = 'transport'
      }
    }

    // Определяем тип для НОЧНОЙ смены
    if (isMedicalBrigade && !hasDoctorNight) {
      const paramedicCountNight = assignedNight.filter(e => e.type === 'paramedic').length
      if (paramedicCountNight >= 2) {
        finalBrigadeTypeNight = 'linear'
      } else {
        finalBrigadeTypeNight = 'transport'
      }
    }

    // Предупреждение если тип изменился
    if (isMedicalBrigade && (!hasDoctorDay || !hasDoctorNight)) {
      const changedParts = []
      if (!hasDoctorDay) changedParts.push('день')
      if (!hasDoctorNight) changedParts.push('ночь')

      warnings.push({
        code: 'BRIGADE_TYPE_CHANGED',
        message: `Бригада ${brigade.number}: нет врача (${changedParts.join(', ')}), тип изменён с "${BRIGADE_TYPE_NAMES[brigade.type]}" на "${BRIGADE_TYPE_NAMES[finalBrigadeTypeDay]}" / "${BRIGADE_TYPE_NAMES[finalBrigadeTypeNight]}"`,
        severity: 'warning',
      })
    }

    // Определяем номер для ДНЕВНОЙ смены
    // Для линейных бригад — используем номер из настроек
    // Для врачебных бригад без врача — генерируем в диапазоне 60+
    const needs60RangeDay = isMedicalBrigade && !hasDoctorDay
    const needs60RangeNight = isMedicalBrigade && !hasDoctorNight

    // Если тип одинаковый на обе смены — один номер на сутки
    const sameTypeBothShifts = finalBrigadeTypeDay === finalBrigadeTypeNight

    if (sameTypeBothShifts && needs60RangeDay) {
      // Одинаковый тип (linear/transport) на обе смены → один номер
      typeSequenceCounters[finalBrigadeTypeDay]++
      const sharedNumber = generateBrigadeNumber(
        substationNumber,
        finalBrigadeTypeDay,
        typeSequenceCounters[finalBrigadeTypeDay],
        usedBrigadeNumbers,
      )
      finalBrigadeNumberDay = sharedNumber
      finalBrigadeNumberNight = sharedNumber
    } else {
      // Разные типы или оба из настроек → отдельные номера
      if (!needs60RangeDay) {
        finalBrigadeNumberDay = brigade.number ?? ''
      } else {
        typeSequenceCounters[finalBrigadeTypeDay]++
        finalBrigadeNumberDay = generateBrigadeNumber(
          substationNumber,
          finalBrigadeTypeDay,
          typeSequenceCounters[finalBrigadeTypeDay],
          usedBrigadeNumbers,
        )
      }

      if (!needs60RangeNight) {
        finalBrigadeNumberNight = brigade.number ?? ''
      } else {
        typeSequenceCounters[finalBrigadeTypeNight]++
        finalBrigadeNumberNight = generateBrigadeNumber(
          substationNumber,
          finalBrigadeTypeNight,
          typeSequenceCounters[finalBrigadeTypeNight],
          usedBrigadeNumbers,
        )
      }
    }

    usedBrigadeNumbers.add(finalBrigadeNumberDay)
    if (finalBrigadeNumberDay !== finalBrigadeNumberNight) {
      usedBrigadeNumbers.add(finalBrigadeNumberNight)
    }

    // Удаляем распределённых сотрудников из пула
    const assignedDayKeys = new Set(assignedDay.map(e => e.fullName))
    const assignedNightKeys = new Set(assignedNight.map(e => e.fullName))

    dayEmployees = dayEmployees.filter(e => !assignedDayKeys.has(e.fullName))
    nightEmployees = nightEmployees.filter(e => !assignedNightKeys.has(e.fullName))

    brigadeRows.push({
      key: `brigade-${finalBrigadeNumberDay}-${finalBrigadeNumberNight}`,
      brigadeNumberDay: finalBrigadeNumberDay,
      brigadeNumberNight: finalBrigadeNumberNight,
      brigadeTypeDay: finalBrigadeTypeDay,
      brigadeTypeNight: finalBrigadeTypeNight,
      shiftDay,
      shiftNight,
      employeesDay: assignedDay,
      employeesNight: assignedNight,
      arrivalTimeDay: formatArrivalTime(brigade.startTime),
      arrivalTimeNight: formatArrivalTimeNight(brigade.startTime),
    })

    // Проверка: только 1 ФВС без других сотрудников (день)
    const onlyIndependentDay = assignedDay.length === 1 &&
      assignedDay[0]?.type === 'paramedic_independent'
    if (onlyIndependentDay) {
      warnings.push({
        code: 'SOLO_INDEPENDENT_PARAMEDIC_DAY',
        message: `Бригада ${finalBrigadeNumberDay} (день): только 1 фельдшер выезжающий самостоятельно без других сотрудников`,
        severity: 'warning',
      })
    }

    // Проверка: только 1 ФВС без других сотрудников (ночь)
    const onlyIndependentNight = assignedNight.length === 1 &&
      assignedNight[0]?.type === 'paramedic_independent'
    if (onlyIndependentNight) {
      warnings.push({
        code: 'SOLO_INDEPENDENT_PARAMEDIC_NIGHT',
        message: `Бригада ${finalBrigadeNumberNight} (ночь): только 1 фельдшер выезжающий самостоятельно без других сотрудников`,
        severity: 'warning',
      })
    }
  }

  // Перераспределение неразмещённых ФВС по линейным бригадам
  // Проверяем, есть ли линейные бригады без ФВС куда можно добавить сотрудника
  const unassignedIndependentParamedicsDay = dayEmployees.filter(e => e.type === 'paramedic_independent')
  const unassignedIndependentParamedicsNight = nightEmployees.filter(e => e.type === 'paramedic_independent')

  for (const emp of unassignedIndependentParamedicsDay) {
    // Ищем линейную бригаду без ФВС в дневной смене
    const targetBrigade = brigadeRows.find(row =>
      row.brigadeTypeDay === 'linear' &&
      !(row.employeesDay as (Employee & { type?: EmployeeType })[]).some(e => e.type === 'paramedic_independent')
    )

    if (targetBrigade) {
      targetBrigade.employeesDay.unshift(emp)
      const idx = dayEmployees.indexOf(emp)
      if (idx !== -1) dayEmployees.splice(idx, 1)
    }
  }

  for (const emp of unassignedIndependentParamedicsNight) {
    // Ищем линейную бригаду без ФВС в ночной смене
    const targetBrigade = brigadeRows.find(row =>
      row.brigadeTypeNight === 'linear' &&
      !(row.employeesNight as (Employee & { type?: EmployeeType })[]).some(e => e.type === 'paramedic_independent')
    )

    if (targetBrigade) {
      targetBrigade.employeesNight.unshift(emp)
      const idx = nightEmployees.indexOf(emp)
      if (idx !== -1) nightEmployees.splice(idx, 1)
    }
  }

  // Проверка: оставшиеся неразмещённые ФВС
  const stillUnassignedIndependent = [
    ...dayEmployees.filter(e => e.type === 'paramedic_independent'),
    ...nightEmployees.filter(e => e.type === 'paramedic_independent'),
  ]
  const seen = new Set<string>()
  const uniqueStillUnassigned = stillUnassignedIndependent.filter(e => {
    if (seen.has(e.fullName)) return false
    seen.add(e.fullName)
    return true
  })

  for (const emp of uniqueStillUnassigned) {
    warnings.push({
      code: 'UNASSIGNED_INDEPENDENT_PARAMEDIC',
      message: `ФВС "${emp.fullName}" не размещён ни в одну из бригад (Линейных бригад меньше чем ФВС), смена "${emp.shift?.start}"\\"${emp.shift?.end}"`,
      severity: 'warning',
    })
  }

  // Generate support services
  const supportServices: SupportService[] = generateSupportServices(employeesOnDay)

  // Check for warnings
  for (const row of brigadeRows) {
    if (row.employeesDay.length === 0) {
      warnings.push({
        code: 'EMPTY_BRIGADE_DAY',
        message: `Бригада ${row.brigadeNumberDay} (день): нет сотрудников`,
        severity: 'warning',
      })
    }
    if (row.employeesNight.length === 0) {
      warnings.push({
        code: 'EMPTY_BRIGADE_NIGHT',
        message: `Бригада ${row.brigadeNumberDay} (ночь): нет сотрудников`,
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
    numberSubstation: substationNumber ?? 0,
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
  const dispatchers = findByKeyword(['диспетчер', 'дисп'])
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
  const fuelBlock = findByKeyword(['заправ', 'блок'])
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
