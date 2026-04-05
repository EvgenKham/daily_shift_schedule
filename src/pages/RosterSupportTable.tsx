import { Table, Typography, Input, Space } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'

import type { SupportService, SupportPosition } from '../features/roster/types'

const { Text } = Typography

interface RosterSupportTableProps {
  supportServices: SupportService[]
  notes: string[]
  doctorSignature: string
  nurseSignature: string
  onChange?: (updates: Partial<RosterSupportTableProps>) => void
}

type TableRow =
  | { type: 'service-header'; name: string; key: string }
  | { type: 'position'; service: SupportService; position: SupportPosition; shiftDay: string; shiftNight: string; key: string }

/**
 * Компонент таблицы вспомогательных служб (Страница 2)
 *
 * Структура по образцу PDF:
 * - Колонки: смена | Состав смены (день) | Время прихода\ухода подпись | смена | Состав смены (ночь) | Время прихода\ухода подпись
 * - Заголовки служб spanning все колонки
 * - Данные построчно
 */
export function RosterSupportTable({
  supportServices,
  notes,
  doctorSignature,
  nurseSignature,
  onChange,
}: RosterSupportTableProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null)

  const handleEmployeeEdit = (
    positionKey: string,
    shiftType: 'day' | 'night',
    newValue: string,
  ) => {
    if (!onChange) return

    const updated = supportServices.map((service) => ({
      ...service,
      positions: service.positions.map((pos) => {
        if (pos.key !== positionKey) return pos

        const employee = shiftType === 'day' ? pos.employeeDay : pos.employeeNight
        if (employee) {
          const updatedEmployee = { ...employee, fullName: newValue }
          return {
            ...pos,
            employeeDay: shiftType === 'day' ? updatedEmployee : pos.employeeDay,
            employeeNight: shiftType === 'night' ? updatedEmployee : pos.employeeNight,
          }
        }
        return pos
      }),
    }))

    onChange({ supportServices: updated })
    setEditingCell(null)
  }

  const handleNoteChange = (index: number, value: string) => {
    if (!onChange) return
    const updated = [...notes]
    updated[index] = value
    onChange({ notes: updated })
  }

  // Формируем строки таблицы
  const tableRows: TableRow[] = []
  supportServices.forEach((service) => {
    tableRows.push({ type: 'service-header', name: service.displayName, key: `header-${service.name}` })
    service.positions.forEach((pos) => {
      tableRows.push({
        type: 'position',
        service,
        position: pos,
        shiftDay: pos.shiftDay,
        shiftNight: pos.shiftNight,
        key: pos.key,
      })
    })
  })

  const columns: TableColumnsType<TableRow> = [
    {
      title: 'смена',
      key: 'shift-day',
      width: 100,
      align: 'center',
      render: (_, record) => {
        if (record.type === 'service-header') return null
        return <Text strong>{record.shiftDay}</Text>
      },
    },
    {
      title: 'Состав смены (день)',
      key: 'composition-day',
      render: (_, record) => {
        if (record.type === 'service-header') return null
        const emp = record.position.employeeDay
        if (!emp) return <Text type="secondary">—</Text>

        const cellKey = `${record.position.key}-day`
        const isEditing = editingCell === cellKey

        return isEditing ? (
          <Input
            defaultValue={emp.fullName}
            size="small"
            style={{ width: '100%' }}
            onBlur={(e) => handleEmployeeEdit(record.position.key, 'day', e.target.value)}
            onPressEnter={(e) => handleEmployeeEdit(record.position.key, 'day', e.currentTarget.value)}
            autoFocus
          />
        ) : (
          <div
            onClick={() => setEditingCell(cellKey)}
            style={{ cursor: 'pointer', padding: '2px 4px', borderRadius: 2 }}
            title="Нажмите для редактирования"
          >
            {emp.prefix ? <Text strong style={{ marginRight: 4 }}>{emp.prefix}</Text> : null}{emp.fullName}
          </div>
        )
      },
    },
    {
      title: 'Время\nприхода\\ухода\nподпись',
      key: 'arrival-day',
      width: 100,
      render: () => '',
    },
    {
      title: 'смена',
      key: 'shift-night',
      width: 100,
      align: 'center',
      render: (_, record) => {
        if (record.type === 'service-header') return null
        return record.shiftNight ? <Text strong>{record.shiftNight}</Text> : <Text type="secondary">—</Text>
      },
    },
    {
      title: 'Состав смены (ночь)',
      key: 'composition-night',
      render: (_, record) => {
        if (record.type === 'service-header') return null
        if (!record.shiftNight) return <Text type="secondary">—</Text>

        const emp = record.position.employeeNight
        if (!emp) return <Text type="secondary">—</Text>

        const cellKey = `${record.position.key}-night`
        const isEditing = editingCell === cellKey

        return isEditing ? (
          <Input
            defaultValue={emp.fullName}
            size="small"
            style={{ width: '100%' }}
            onBlur={(e) => handleEmployeeEdit(record.position.key, 'night', e.target.value)}
            onPressEnter={(e) => handleEmployeeEdit(record.position.key, 'night', e.currentTarget.value)}
            autoFocus
          />
        ) : (
          <div
            onClick={() => setEditingCell(cellKey)}
            style={{ cursor: 'pointer', padding: '2px 4px', borderRadius: 2 }}
            title="Нажмите для редактирования"
          >
            {emp.prefix ? <Text strong style={{ marginRight: 4 }}>{emp.prefix}</Text> : null}{emp.fullName}
          </div>
        )
      },
    },
    {
      title: 'Время\nприхода\\ухода\nподпись',
      key: 'arrival-night',
      width: 100,
      render: (_, record) => {
        if (record.type === 'service-header') return null
        return record.shiftNight ? '' : <Text type="secondary">—</Text>
      },
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Table<TableRow>
        columns={columns}
        dataSource={tableRows}
        rowKey="key"
        pagination={false}
        size="small"
        bordered
        locale={{ emptyText: 'Вспомогательные службы не назначены' }}
        components={{
          body: {
            row: (props: React.HTMLAttributes<HTMLTableRowElement> & { 'data-row-key': string }) => {
              const record = props['data-row-key']
              const rowData = tableRows.find(r => r.key === record)
              const isHeader = rowData?.type === 'service-header'
              if (isHeader && rowData.type === 'service-header') {
                return (
                  <tr {...props} style={{ backgroundColor: '#f0f0f0' }}>
                    <td colSpan={6} style={{ textAlign: 'center', fontWeight: 'bold', padding: '4px 8px' }}>
                      {rowData.name}
                    </td>
                  </tr>
                )
              }
              return <tr {...props} />
            },
          },
        }}
      />

      {/* Примечания */}
      <div style={{ padding: '8px 0' }}>
        <Text type="secondary">Опоздания, невыход на работу (больничный лист, повестка и т.д.)</Text>
        {notes.map((note, idx) => (
          <div key={idx}>
            <Input
              value={note}
              onChange={(e) => handleNoteChange(idx, e.target.value)}
              placeholder={`Строка ${idx + 1}`}
              size="small"
              style={{ marginBottom: 4 }}
            />
          </div>
        ))}
      </div>

      {/* Подписи */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '8px 0', rowGap: '20px'}}>
        <Space style={{ display: 'flex', justifyContent: 'space-between'}}>
          <Text>Врач СМП:</Text>
          <Input
            value={doctorSignature}
            onChange={(e) => onChange?.({ doctorSignature: e.target.value })}
            style={{ width: 200 }}
            placeholder="ФИО"
            size="small"
          />
        </Space>
        <Space style={{ display: 'flex', justifyContent: 'space-between'}}>
          <Text>Фельдшер (Старший):</Text>
          <Input
            value={nurseSignature}
            onChange={(e) => onChange?.({ nurseSignature: e.target.value })}
            style={{ width: 200 }}
            placeholder="ФИО"
            size="small"
          />
        </Space>
      </div>

      {/* Блок "Внимание!" */}
      <div style={{ border: '1px solid #ff4d4f', borderRadius: 4, padding: '8px 12px', backgroundColor: '#fff2f0' }}>
        <Text strong type="danger">Внимание!</Text>
        <div style={{ marginTop: 8 }}>
          <Text>1. Приступая к работе, включить радиостанцию и обеспечить её нахождение в автомобиле СМП.</Text>
        </div>
        <div>
          <Text>2. При обнаружении очереди в приемном отделении какого-либо стационара, немедленно докладывать об этом старшему врачу оперативного отдела.</Text>
        </div>
        <div>
          <Text>3. О любом изменении своего местоположения (приезд по адресу вызова, завершение вызова, освобождение в стационаре) или задержке на вызове более 1 часа обязательно сообщать диспетчеру.</Text>
        </div>
      </div>
    </Space>
  )
}
