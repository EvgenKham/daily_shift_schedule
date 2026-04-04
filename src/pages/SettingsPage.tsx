import { Button, Card, Form, Input, InputNumber, Select, Space, Typography, message } from 'antd'
import { useEffect } from 'react'
import { loadJson, saveJson } from '../shared/storage/localStorageJson'

type BrigadeType = 'bit' | 'pediatric' | 'linear' | 'transport'

type StartTime = '7:00' | '7:30' | '8:00' | '8:30' | '9:00'

const START_TIMES: StartTime[] = ['7:00', '7:30', '8:00', '8:30', '9:00']

const BRIGADE_TYPE_COLORS: Record<BrigadeType, string> = {
  bit: '#ca3956',
  pediatric: '#b6a511',
  linear: '#78c98b',
  transport: '#008da0',
}

function formatStartTimeLabel(t: StartTime) {
  const [h, m] = t.split(':')
  return `${h.padStart(2, '0')}:${m}`
}

function normalizeBrigadeType(raw: unknown): BrigadeType {
  if (raw === 'bit' || raw === 'pediatric' || raw === 'linear' || raw === 'transport') return raw
  // Backward compatibility for older saved settings.
  if (raw === '24h' || raw === 'day' || raw === 'night') return 'bit'
  return 'bit'
}

function normalizeStartTime(raw: unknown): StartTime {
  return START_TIMES.includes(raw as StartTime) ? (raw as StartTime) : '8:00'
}

type BrigadeSettings = {
  number: string
  type: BrigadeType
  startTime: StartTime
}

type Settings = {
  userName: string
  substationNumber: number | null
  chiefParamedicName: string
  headOfSubstationName: string
  brigades: BrigadeSettings[]
}

const STORAGE_KEY = 'dss_settings_v1'

const defaultSettings: Settings = {
  userName: '',
  substationNumber: null,
  chiefParamedicName: '',
  headOfSubstationName: '',
  brigades: [],
}

export function SettingsPage() {
  const [form] = Form.useForm<Settings>()
  const [msg, contextHolder] = message.useMessage()

  const brigadesValue = Form.useWatch('brigades', form) as BrigadeSettings[] | undefined

  useEffect(() => {
    const stored = loadJson<unknown>(STORAGE_KEY) as
      | (Settings & { brigades?: Array<unknown> })
      | null

    const brigades = Array.isArray(stored?.brigades)
      ? stored.brigades.map((b: unknown) => {
          const maybe = b as { number?: unknown; type?: unknown; startTime?: unknown } | null
          return {
            number: String(maybe?.number ?? ''),
            type: normalizeBrigadeType(maybe?.type),
            startTime: normalizeStartTime(maybe?.startTime),
          }
        })
      : []

    form.setFieldsValue(
      stored
        ? {
            userName: String(stored.userName ?? ''),
            substationNumber:
              typeof stored.substationNumber === 'number' ? stored.substationNumber : (null as number | null),
            chiefParamedicName: String(stored.chiefParamedicName ?? ''),
            headOfSubstationName: String(stored.headOfSubstationName ?? ''),
            brigades,
          }
        : defaultSettings,
    )
  }, [form])

  return (
    <>
      {contextHolder}
      <Space orientation="vertical" size={16} style={{ display: 'flex' }}>
        <Card
          title="Настройки"
          extra={<Typography.Text type="secondary">Сохраняется локально (localStorage)</Typography.Text>}
        >
          <Form<Settings>
            form={form}
            layout="vertical"
            onFinish={(values) => {
              saveJson(STORAGE_KEY, values)
              void msg.success('Настройки сохранены')
            }}
          >
            <Space orientation="vertical" size={8} style={{ display: 'flex' }}>
              <Form.Item label="Имя пользователя" name="userName">
                <Input placeholder="Евгений" />
              </Form.Item>

              <Form.Item label="Номер подстанции" name="substationNumber">
                <InputNumber style={{ width: '100%' }} min={1} placeholder="Например: 11" />
              </Form.Item>

              <Form.Item label="ФИО старшего фельдшера" name="chiefParamedicName">
                <Input placeholder="Лазарь Д.Г." />
              </Form.Item>

              <Form.Item label="ФИО заведующего подстанцией" name="headOfSubstationName">
                <Input placeholder="Юдаков Е.Ю.." />
              </Form.Item>
            </Space>

            <Card size="small" title="Бригады" style={{ marginTop: 8, backgroundColor: "#e2e2e2"}}>
              <Form.List name="brigades">
                {(fields, { add, remove }) => (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                        gap: 12,
                        alignItems: 'start',
                      }}
                    >
                      {fields.map((field) => (
                        (() => {
                          const brigadeType = brigadesValue?.[field.name]?.type
                          const color = brigadeType ? BRIGADE_TYPE_COLORS[brigadeType] : undefined

                          return (
                        <Card
                          key={field.key}
                          size="small"
                          title={
                            <span style={{ color: color ? '#1f1f1f' : undefined, fontWeight: 600 }}>
                              Бригада #{field.name + 1}
                            </span>
                          }
                          extra={
                            <Button danger size="small" onClick={() => remove(field.name)}>
                              Удалить
                            </Button>
                          }
                          style={{
                            width: '100%',
                            borderStyle: 'solid',
                            borderWidth: 1,
                            borderColor: color ?? '#d9d9d9',
                            boxShadow: 'none',
                          }}
                          headStyle={{
                            backgroundColor: color,
                            borderColor: color ?? '#d9d9d9',
                          }}
                          bodyStyle={{ backgroundColor: '#fff' }}
                        >
                          <Space orientation="vertical" size={6} style={{ display: 'flex' }}>
                            <Form.Item
                              label="Номер"
                              name={[field.name, 'number']}
                              rules={[{ required: true, message: 'Укажите номер' }]}
                            >
                              <Input placeholder="Например: 1151" />
                            </Form.Item>

                            <Form.Item
                              label="Тип"
                              name={[field.name, 'type']}
                              rules={[{ required: true, message: 'Выберите тип' }]}
                            >
                              <Select
                                options={[
                                  { value: 'bit', label: 'БИТ' },
                                  { value: 'pediatric', label: 'Педиатрическая' },
                                  { value: 'linear', label: 'Линейная' },
                                ]}
                              />
                            </Form.Item>

                            <Form.Item
                              label="Время старта"
                              name={[field.name, 'startTime']}
                              rules={[{ required: true, message: 'Выберите время' }]}
                            >
                              <Select
                                options={START_TIMES.map((t) => ({ value: t, label: formatStartTimeLabel(t) }))}
                              />
                            </Form.Item>
                          </Space>
                        </Card>
                          )
                        })()
                      ))}
                    </div>

                    <Space wrap style={{ marginTop: 12 }}>
                      <Button
                        onClick={() =>
                          add({
                            number: '',
                            type: 'bit' as const,
                            startTime: '8:00' as const,
                          })
                        }
                      >
                        Добавить бригаду
                      </Button>
                    </Space>
                  </>
                )}
              </Form.List>
            </Card>

            <Space wrap style={{ marginTop: 16 }}>
              <Button type="primary" htmlType="submit">
                Сохранить
              </Button>
              <Button
                onClick={() => {
                  form.setFieldsValue(defaultSettings)
                  saveJson(STORAGE_KEY, defaultSettings)
                  void msg.success('Сброшено')
                }}
              >
                Сбросить
              </Button>
            </Space>
          </Form>
        </Card>
      </Space>
    </>
  )
}

