import { Card, Input, Space, Typography, Divider } from 'antd'
import { useState } from 'react'

import type { SupportService } from '../features/roster/types'

const { Text } = Typography

interface RosterSupportTableProps {
  supportServices: SupportService[]
  notes: string[]
  doctorSignature: string
  nurseSignature: string
  onChange?: (updates: Partial<RosterSupportTableProps>) => void
}

/**
 * Компонент таблицы вспомогательных служб (Страница 2)
 *
 * Структура по образцу PDF:
 * - ДИСПЕТЧЕРСКАЯ
 * - ЗАПРАВОЧНЫЙ БЛОК
 * - УБОРЩИК ПОМЕЩЕНИЙ (СЛУЖЕБНЫХ)
 * - УБОРЩИК ТЕРРИТОРИИ
 * - Примечания (5 строк)
 * - Подписи
 */
export function RosterSupportTable({
  supportServices,
  notes,
  doctorSignature,
  nurseSignature,
  onChange,
}: RosterSupportTableProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null)

  const handleNoteChange = (index: number, value: string) => {
    if (!onChange) return
    const updated = [...notes]
    updated[index] = value
    onChange({ notes: updated })
  }

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

  const renderServiceSection = (service: SupportService) => {
    if (service.positions.length === 0) {
      return (
        <Card key={service.name} size="small" title={service.displayName} style={{ marginBottom: 12 }}>
          <Text type="secondary">Нет сотрудников</Text>
        </Card>
      )
    }

    return (
      <Card key={service.name} size="small" title={service.displayName} style={{ marginBottom: 12 }}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {service.positions.map((pos) => (
            <Space key={pos.key} wrap style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Text strong>День ({pos.shiftDay}):</Text>
                {pos.employeeDay ? (
                  editingCell === `${pos.key}-day` ? (
                    <Input
                      defaultValue={pos.employeeDay.fullName}
                      size="small"
                      style={{ width: 200 }}
                      onBlur={(e) =>
                        handleEmployeeEdit(pos.key, 'day', e.target.value)
                      }
                      onPressEnter={(e) =>
                        handleEmployeeEdit(pos.key, 'day', e.currentTarget.value)
                      }
                      autoFocus
                    />
                  ) : (
                    <Text
                      onClick={() => setEditingCell(`${pos.key}-day`)}
                      style={{ cursor: 'pointer', padding: '2px 4px', borderRadius: 2 }}
                      title="Нажмите для редактирования"
                    >
                      {pos.employeeDay.fullName}
                    </Text>
                  )
                ) : (
                  <Text type="secondary">—</Text>
                )}
              </Space>
              <Space>
                <Text strong>Ночь ({pos.shiftNight}):</Text>
                {pos.employeeNight ? (
                  editingCell === `${pos.key}-night` ? (
                    <Input
                      defaultValue={pos.employeeNight.fullName}
                      size="small"
                      style={{ width: 200 }}
                      onBlur={(e) =>
                        handleEmployeeEdit(pos.key, 'night', e.target.value)
                      }
                      onPressEnter={(e) =>
                        handleEmployeeEdit(pos.key, 'night', e.currentTarget.value)
                      }
                      autoFocus
                    />
                  ) : (
                    <Text
                      onClick={() => setEditingCell(`${pos.key}-night`)}
                      style={{ cursor: 'pointer', padding: '2px 4px', borderRadius: 2 }}
                      title="Нажмите для редактирования"
                    >
                      {pos.employeeNight.fullName}
                    </Text>
                  )
                ) : (
                  <Text type="secondary">—</Text>
                )}
              </Space>
            </Space>
          ))}
        </Space>
      </Card>
    )
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* Секции вспомогательных служб */}
      {supportServices.length > 0
        ? supportServices.map((service) => renderServiceSection(service))
        : (
          <Card size="small">
            <Text type="secondary">Вспомогательные службы не назначены</Text>
          </Card>
        )}

      <Divider />

      {/* Примечания */}
      <Card size="small" title="Примечания">
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text type="secondary">Опоздания, невыход на работу (больничный лист, повестка и т.д.)</Text>
          {notes.map((note, idx) => (
            <Input
              key={idx}
              value={note}
              onChange={(e) => handleNoteChange(idx, e.target.value)}
              placeholder={`Строка ${idx + 1}`}
              size="small"
            />
          ))}
        </Space>
      </Card>

      {/* Подписи */}
      <Card size="small" title="Подписи">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text>Врач СМП (Зав. п\с № 11):</Text>
            <Input
              value={doctorSignature}
              onChange={(e) => onChange?.({ doctorSignature: e.target.value })}
              style={{ width: 200 }}
              placeholder="Подпись"
              size="small"
            />
          </Space>
          <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text>Фельдшер (Старший) п\с № 11:</Text>
            <Input
              value={nurseSignature}
              onChange={(e) => onChange?.({ nurseSignature: e.target.value })}
              style={{ width: 200 }}
              placeholder="Подпись"
              size="small"
            />
          </Space>
        </Space>
      </Card>

      {/* Блок "Внимание!" */}
      <Card size="small" title={<Text strong type="danger">Внимание!</Text>}>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Text>
            1. Приступая к работе, включить радиостанцию и обеспечить её нахождение в автомобиле СМП.
          </Text>
          <Text>
            2. При обнаружении очереди в приемном отделении какого-либо стационара, немедленно докладывать об этом старшему врачу оперативного отдела.
          </Text>
          <Text>
            3. О любом изменении своего местоположения (приезд по адресу вызова, завершение вызова, освобождение в стационаре) или задержке на вызове более 1 часа обязательно сообщать диспетчеру.
          </Text>
        </Space>
      </Card>
    </Space>
  )
}
