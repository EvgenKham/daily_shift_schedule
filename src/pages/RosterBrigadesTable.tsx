import { Table, Typography, Input, Space } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'

import type { BrigadeRow, Employee, BrigadeType } from '../features/roster/types'
import { BRIGADE_TYPE_NAMES } from '../features/roster/types'

const { Text } = Typography

const BRIGADE_TYPE_COLORS: Record<BrigadeType, string> = {
  bit: '#ca3956',
  pediatric: '#b6a511',
  linear: '#78c98b',
  transport: '#008da0',
}

interface RosterBrigadesTableProps {
  brigades: BrigadeRow[]
  onChange?: (brigades: BrigadeRow[]) => void
}

/**
 * Компонент таблицы выездных бригад (Страница 1)
 *
 * Структура по образцу PDF (7 колонок):
 * - Бригада\смена (день)
 * - Состав бригады (день)
 * - Время прихода\ухода подпись (день)
 * - Бригада\смена (ночь)
 * - Состав бригады (ночь)
 * - Время прихода\ухода подпись (ночь)
 */
export function RosterBrigadesTable({ brigades, onChange }: RosterBrigadesTableProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null)

  const handleEmployeeEdit = (
    brigadeKey: string,
    shiftType: 'day' | 'night',
    employeeIndex: number,
    newValue: string,
  ) => {
    if (!onChange) return

    const updated = brigades.map((b) => {
      if (b.key !== brigadeKey) return b

      const employees = shiftType === 'day' ? [...b.employeesDay] : [...b.employeesNight]
      if (employees[employeeIndex]) {
        employees[employeeIndex] = { ...employees[employeeIndex], fullName: newValue }
      }

      return {
        ...b,
        employeesDay: shiftType === 'day' ? employees : b.employeesDay,
        employeesNight: shiftType === 'night' ? employees : b.employeesNight,
      }
    })

    onChange(updated)
    setEditingCell(null)
  }

  const renderEmployeeList = (employees: Employee[], shiftType: 'day' | 'night', brigadeKey: string) => {
    if (employees.length === 0) {
      return <Text type="secondary">Нет сотрудников</Text>
    }

    return (
      <Space direction="vertical" size={0} style={{ width: '100%' }}>
        {employees.map((emp, idx) => {
          const cellKey = `${brigadeKey}-${shiftType}-emp-${idx}`
          const isEditing = editingCell === cellKey

          return (
            <div key={emp.fullName} style={{ marginBottom: 4 }}>
              {isEditing ? (
                <Input
                  defaultValue={emp.fullName}
                  size="small"
                  style={{ width: '90%' }}
                  onBlur={(e) => handleEmployeeEdit(brigadeKey, shiftType, idx, e.target.value)}
                  onPressEnter={(e) => handleEmployeeEdit(brigadeKey, shiftType, idx, e.currentTarget.value)}
                  autoFocus
                />
              ) : (
                <div
                  className="employee-name"
                  onClick={() => setEditingCell(cellKey)}
                  style={{ cursor: 'pointer', padding: '2px 4px', borderRadius: 2 }}
                  title="Нажмите для редактирования"
                >
                  {emp.prefix ? `${emp.prefix} ` : ''}{emp.fullName}
                </div>
              )}
            </div>
          )
        })}
      </Space>
    )
  }

  const columns: TableColumnsType<BrigadeRow> = [
    {
      title: 'Бригада\\смена',
      dataIndex: 'brigadeNumberDay',
      key: 'brigade-day',
      width: 120,
      align: 'center',
      onCell: (record) => ({
        style: { backgroundColor: BRIGADE_TYPE_COLORS[record.brigadeTypeDay] + '33' },
      }),
      render: (_, record) => (
        <Space direction="vertical" size={0} style={{ alignItems: 'center' }}>
          <Text strong>
            {BRIGADE_TYPE_NAMES[record.brigadeTypeDay]}
          </Text>
          <Text strong>{record.brigadeNumberDay}</Text>
          <Text type="secondary">{record.shiftDay}</Text>
        </Space>
      ),
    },
    {
      title: 'Состав бригады (день)',
      dataIndex: 'employeesDay',
      key: 'composition-day',
      onCell: (record) => ({
        style: { backgroundColor: BRIGADE_TYPE_COLORS[record.brigadeTypeDay] + '33' },
      }),
      render: (_, record) => renderEmployeeList(record.employeesDay, 'day', record.key),
    },
    {
      title: 'Время\nприхода\\ухода\nподпись',
      key: 'arrival-signature-day',
      width: 100,
      onCell: (record) => ({
        style: { backgroundColor: BRIGADE_TYPE_COLORS[record.brigadeTypeDay] + '33' },
      }),
      render: () => '',
    },
    {
      title: 'Бригада\\смена',
      key: 'brigade-night',
      width: 120,
      align: 'center',
      onCell: (record) => ({
        style: { backgroundColor: BRIGADE_TYPE_COLORS[record.brigadeTypeNight] + '33' },
      }),
      render: (_, record) => (
        <Space direction="vertical" size={0} style={{ alignItems: 'center' }}>
          <Text strong>
            {BRIGADE_TYPE_NAMES[record.brigadeTypeNight]}
          </Text>
          <Text strong>{record.brigadeNumberNight}</Text>
          <Text type="secondary">{record.shiftNight}</Text>
        </Space>
      ),
    },
    {
      title: 'Состав бригады (ночь)',
      key: 'composition-night',
      onCell: (record) => ({
        style: { backgroundColor: BRIGADE_TYPE_COLORS[record.brigadeTypeNight] + '33' },
      }),
      render: (_, record) => renderEmployeeList(record.employeesNight, 'night', record.key),
    },
    {
      title: 'Время\nприхода\\ухода\nподпись',
      key: 'arrival-signature-night',
      width: 100,
      onCell: (record) => ({
        style: { backgroundColor: BRIGADE_TYPE_COLORS[record.brigadeTypeNight] + '33' },
      }),
      render: () => '',
    },
  ]

  return (
    <div className="roster-brigades-table">
      <style>{`
        tr {
          background-color: transparent !important;
        }
        .roster-brigades-table .ant-table-cell,
        .roster-brigades-table .ant-table-thead > th,
        .roster-brigades-table .ant-table-tbody > td {
          border-color: #a5a5a5 !important;
        }
        .roster-brigades-table .employee-name:hover {
          background-color: #ffffff;
          border-radius: 4px;
        }
      `}</style>
      <Table
        columns={columns}
        dataSource={brigades}
        rowKey="key"
        pagination={false}
        size="small"
        bordered
        locale={{ emptyText: 'Нет бригад на эту смену' }}
      />
    </div>
  )
}
