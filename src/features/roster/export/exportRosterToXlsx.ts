import * as XLSX from 'xlsx'
import type { RosterData } from '../types'

export function exportRosterToXlsx(roster: RosterData, fileName?: string): void {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Brigades
  const sheet1 = createBrigadesSheet(roster)
  XLSX.utils.book_append_sheet(wb, sheet1, 'Выездные бригады')

  // Sheet 2: Support services
  const sheet2 = createSupportSheet(roster)
  XLSX.utils.book_append_sheet(wb, sheet2, 'Вспомогательные службы')

  // Trigger download
  XLSX.writeFile(wb, fileName || `roster_${roster.dateKey}.xlsx`)
}

function createBrigadesSheet(roster: RosterData): XLSX.WorkSheet {
  const data: XLSX.CellObject[][] = []

  // Row 0: Title
  data.push([{ v: 'Наряд', t: 's' }])

  // Row 1: Date
  const dateStr = roster.dateKey.split('-').reverse().join('.')
  data.push([{ v: dateStr, t: 's' }])

  // Row 2: Empty spacer
  data.push([{ v: '', t: 's' }])

  // Row 3: Header
  data.push([{ v: 'ВЫЕЗДНЫЕ БРИГАДЫ', t: 's' }])

  // Row 4: Column headers
  data.push([
    { v: 'Бригада\\смена (день)', t: 's' },
    { v: 'Состав бригады (день)', t: 's' },
    { v: 'Время прихода', t: 's' },
    { v: 'Подпись', t: 's' },
    { v: 'Бригада\\смена (ночь)', t: 's' },
    { v: 'Состав бригады (ночь)', t: 's' },
    { v: 'Время прихода/ухода', t: 's' },
    { v: 'Подпись', t: 's' },
  ])

  // Row 5+: Brigade rows
  for (const brigade of roster.brigades) {
    const employeesDay = brigade.employeesDay.map((e) => e.fullName).join('; ')
    const employeesNight = brigade.employeesNight.map((e) => e.fullName).join('; ')

    data.push([
      { v: `${brigade.brigadeNumber} ${brigade.shiftDay}`, t: 's' },
      { v: employeesDay || '—', t: 's' },
      { v: brigade.arrivalTimeDay || '', t: 's' },
      { v: '', t: 's' },
      { v: `${brigade.brigadeNumber} ${brigade.shiftNight}`, t: 's' },
      { v: employeesNight || '—', t: 's' },
      { v: brigade.arrivalTimeNight || '', t: 's' },
      { v: '', t: 's' },
    ])
  }

  const ws = XLSX.utils.aoa_to_sheet(data)

  // Set column widths
  ws['!cols'] = [
    { wch: 18 }, // Бригада/смена день
    { wch: 50 }, // Состав день
    { wch: 15 }, // Время день
    { wch: 10 }, // Подпись день
    { wch: 18 }, // Бригада/смена ночь
    { wch: 50 }, // Состав ночь
    { wch: 18 }, // Время ночь
    { wch: 10 }, // Подпись ночь
  ]

  // Merge title (row 0, cols 0-7)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, // Title
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }, // Date
    { s: { r: 3, c: 0 }, e: { r: 3, c: 7 } }, // Header "ВЫЕЗДНЫЕ БРИГАДЫ"
  ]

  // Add borders and styling
  applyStyles(ws, data.length - 1, 8)

  return ws
}

function createSupportSheet(roster: RosterData): XLSX.WorkSheet {
  const data: XLSX.CellObject[][] = []

  // Row 0: Title
  data.push([{ v: 'Наряд', t: 's' }])

  // Row 1: Date
  const dateStr = roster.dateKey.split('-').reverse().join('.')
  data.push([{ v: dateStr, t: 's' }])

  // Row 2: Empty spacer
  data.push([{ v: '', t: 's' }])

  // Row 3: Header
  data.push([{ v: 'ВСПОМОГАТЕЛЬНЫЕ СЛУЖБЫ', t: 's' }])

  // Row 4: Empty spacer
  data.push([{ v: '', t: 's' }])

  // Render each support service
  for (const service of roster.supportServices) {
    // Service header
    data.push([{ v: service.displayName, t: 's' }])

    // Column headers
    data.push([
      { v: 'смена (день)', t: 's' },
      { v: 'Состав (день)', t: 's' },
      { v: 'Время', t: 's' },
      { v: 'Подпись', t: 's' },
      { v: 'смена (ночь)', t: 's' },
      { v: 'Состав (ночь)', t: 's' },
      { v: 'Время', t: 's' },
      { v: 'Подпись', t: 's' },
    ])

    // Positions
    for (const pos of service.positions) {
      data.push([
        { v: pos.shiftDay, t: 's' },
        { v: pos.employeeDay?.fullName || '—', t: 's' },
        { v: pos.arrivalTimeDay || '', t: 's' },
        { v: '', t: 's' },
        { v: pos.shiftNight, t: 's' },
        { v: pos.employeeNight?.fullName || '—', t: 's' },
        { v: pos.arrivalTimeNight || '', t: 's' },
        { v: '', t: 's' },
      ])
    }

    // Empty spacer
    data.push([{ v: '', t: 's' }])
  }

  // Notes section
  data.push([{ v: 'Примечания:', t: 's' }])
  data.push([{ v: 'Опоздания, невыход на работу (больничный лист, повестка и т.д.)', t: 's' }])
  for (const note of roster.notes) {
    data.push([{ v: note, t: 's' }])
  }

  // Empty spacer
  data.push([{ v: '', t: 's' }])

  // Signatures
  data.push([
    { v: 'Должность и Ф.И.О. лица, внесшего данные', t: 's' },
    { v: '', t: 's' },
    { v: 'Роспись', t: 's' },
  ])

  data.push([
    { v: 'Врач СМП (Зав. п\\с № 11)', t: 's' },
    { v: roster.doctorSignature, t: 's' },
    { v: '', t: 's' },
  ])

  data.push([
    { v: 'Фельдшер (Старший) п\\с № 11', t: 's' },
    { v: roster.nurseSignature, t: 's' },
    { v: '', t: 's' },
  ])

  // Empty spacer
  data.push([{ v: '', t: 's' }])

  // Attention block
  data.push([{ v: 'Внимание!', t: 's' }])
  data.push([{ v: '1. Приступая к работе, включить радиостанцию и обеспечить её нахождение в автомобиле СМП.', t: 's' }])
  data.push([{ v: '2. При обнаружении очереди в приемном отделении какого-либо стационара, немедленно докладывать об этом старшему врачу оперативного отдела.', t: 's' }])
  data.push([{ v: '3. О любом изменении своего местоположения (приезд по адресу вызова, завершение вызова, освобождение в стационаре) или задержке на вызове более 1 часа обязательно сообщать диспетчеру.', t: 's' }])

  const ws = XLSX.utils.aoa_to_sheet(data)

  // Set column widths
  ws['!cols'] = [
    { wch: 20 },
    { wch: 50 },
    { wch: 15 },
    { wch: 10 },
    { wch: 20 },
    { wch: 50 },
    { wch: 15 },
    { wch: 10 },
  ]

  // Merge headers
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, // Title
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }, // Date
    { s: { r: 3, c: 0 }, e: { r: 3, c: 7 } }, // Header "ВСПОМОГАТЕЛЬНЫЕ СЛУЖБЫ"
  ]

  // Add styles
  applyStyles(ws, data.length - 1, 8)

  return ws
}

function applyStyles(ws: XLSX.WorkSheet, lastRow: number, colCount: number): void {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')

  for (let R = range.s.r; R <= Math.max(range.e.r, lastRow); R++) {
    for (let C = 0; C < colCount; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
      if (!ws[cellAddress]) continue

      const cell = ws[cellAddress]
      cell.s = {
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } },
        },
        font: { name: 'Calibri', sz: 11 },
        alignment: { vertical: 'center', horizontal: 'left' },
      }

      // Center align headers
      if (R === 4 || R === 5) {
        cell.s!.alignment!.horizontal = 'center'
      }
    }
  }
}
