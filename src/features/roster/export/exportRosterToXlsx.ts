import * as XLSX from 'xlsx'
import type { RosterData } from '../generator/types'

export function exportRosterToXlsx(roster: RosterData, fileName?: string): void {
  const wb = XLSX.utils.book_new()
  const ws = createRosterWorksheet(roster)

  XLSX.utils.book_append_sheet(wb, ws, 'Наряд')

  // Trigger download
  XLSX.writeFile(wb, fileName || `roster_${roster.dateKey}.xlsx`)
}

function createRosterWorksheet(roster: RosterData): XLSX.WorkSheet {
  // Group rows by shift type
  const dayRows = roster.rows.filter((r) => r.shiftType === 'day')
  const nightRows = roster.rows.filter((r) => r.shiftType === 'night')

  // Build data array for the worksheet
  const data: XLSX.CellObject[][] = []

  // Row 0: Title
  data.push([{ v: 'Наряд на смену', t: 's' }])

  // Row 1: Date
  const dateStr = roster.dateKey.split('-').reverse().join('.')
  data.push([{ v: `Дата: ${dateStr}`, t: 's' }])

  // Row 2: Empty spacer
  data.push([{ v: '', t: 's' }])

  // Row 3: Day shift header
  data.push([{ v: 'ДНЕВНАЯ СМЕНА', t: 's' }])

  // Row 4: Column headers
  data.push([
    { v: 'Бригада', t: 's' },
    { v: 'Сотрудники', t: 's' }
  ])

  // Row 5+: Day shift rows
  let currentRow = 5
  for (const row of dayRows) {
    const employeeNames = row.employees.map((e) => e.fullName).join('; ')
    data.push([
      { v: `Бригада ${row.brigade.brigadeNumber}`, t: 's' },
      { v: employeeNames, t: 's' }
    ])
    currentRow++
  }

  // Empty spacer
  data.push([{ v: '', t: 's' }])
  currentRow++

  // Night shift header
  data.push([{ v: 'НОЧНАЯ СМЕНА', t: 's' }])
  currentRow++

  // Column headers
  data.push([
    { v: 'Бригада', t: 's' },
    { v: 'Сотрудники', t: 's' }
  ])
  currentRow++

  // Night shift rows
  for (const row of nightRows) {
    const employeeNames = row.employees.map((e) => e.fullName).join('; ')
    data.push([
      { v: `Бригада ${row.brigade.brigadeNumber}`, t: 's' },
      { v: employeeNames, t: 's' }
    ])
    currentRow++
  }

  // Add warnings if any
  if (roster.warnings.length > 0) {
    data.push([{ v: '', t: 's' }])
    data.push([{ v: 'ПРЕДУПРЕЖДЕНИЯ', t: 's' }])
    for (const warning of roster.warnings) {
      data.push([{
        v: `${warning.severity === 'error' ? 'Ошибка' : 'Предупреждение'}: ${warning.message}`,
        t: 's'
      }])
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(data)

  // Set column widths
  ws['!cols'] = [{ wch: 25 }, { wch: 60 }]

  // Merge title (row 0, cols 0-1)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, // Title
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }, // Date
    { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } }, // Day shift header
    { s: { r: currentRow - nightRows.length - 2, c: 0 }, e: { r: currentRow - nightRows.length - 2, c: 1 } } // Night shift header
  ]

  // Add borders and styling to all cells
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:B1')
  
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
      if (!ws[cellAddress]) continue

      const cell = ws[cellAddress]
      cell.s = {
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        },
        font: { name: 'Calibri', sz: 11 },
        alignment: { vertical: 'center', horizontal: 'left' }
      }

      // Center align headers
      if (R === 4 || R === currentRow - nightRows.length) {
        cell.s!.alignment!.horizontal = 'center'
      }
    }
  }

  return ws
}
