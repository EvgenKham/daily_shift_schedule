import { Button, Card, Form, Input, InputNumber, Select, Space, Typography, message } from 'antd'
import { useEffect } from 'react'
import { loadJson, saveJson } from '../shared/storage/localStorageJson'

type BrigadeType = '24h' | 'day' | 'night'

type BrigadeSettings = {
  id: string
  number: string
  type: BrigadeType
  startTime: '7:00' | '7:30' | '8:00' | '8:30' | '9:00'
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

  useEffect(() => {
    const stored = loadJson<Settings>(STORAGE_KEY)
    form.setFieldsValue(stored ?? defaultSettings)
  }, [form])

  return (
    <>
      {contextHolder}
      <Space direction="vertical" size={16} style={{ display: 'flex' }}>
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
            <Space direction="vertical" size={8} style={{ display: 'flex' }}>
              <Form.Item label="ФИО пользователя" name="userName">
                <Input placeholder="Например: Иванов И.И." />
              </Form.Item>

              <Form.Item label="Номер подстанции" name="substationNumber">
                <InputNumber style={{ width: '100%' }} min={1} placeholder="Например: 12" />
              </Form.Item>

              <Form.Item label="ФИО старшего фельдшера" name="chiefParamedicName">
                <Input placeholder="Например: Петров П.П." />
              </Form.Item>

              <Form.Item label="ФИО заведующего подстанцией" name="headOfSubstationName">
                <Input placeholder="Например: Сидоров С.С." />
              </Form.Item>
            </Space>

            <Card size="small" title="Бригады" style={{ marginTop: 8 }}>
              <Form.List name="brigades">
                {(fields, { add, remove }) => (
                  <Space direction="vertical" size={12} style={{ display: 'flex' }}>
                    {fields.map((field) => (
                      <Card
                        key={field.key}
                        size="small"
                        title={`Бригада #${field.name + 1}`}
                        extra={
                          <Button danger onClick={() => remove(field.name)}>
                            Удалить
                          </Button>
                        }
                      >
                        <Space direction="vertical" size={8} style={{ display: 'flex' }}>
                          <Form.Item
                            {...field}
                            label="ID"
                            name={[field.name, 'id']}
                            rules={[{ required: true, message: 'Укажите ID' }]}
                          >
                            <Input placeholder="Например: brig-01" />
                          </Form.Item>
                          <Form.Item
                            {...field}
                            label="Номер"
                            name={[field.name, 'number']}
                            rules={[{ required: true, message: 'Укажите номер' }]}
                          >
                            <Input placeholder="Например: 103" />
                          </Form.Item>
                          <Form.Item
                            {...field}
                            label="Тип"
                            name={[field.name, 'type']}
                            rules={[{ required: true, message: 'Выберите тип' }]}
                          >
                            <Select
                              options={[
                                { value: '24h', label: 'Суточная' },
                                { value: 'day', label: 'Дневная' },
                                { value: 'night', label: 'Ночная' },
                              ]}
                            />
                          </Form.Item>
                          <Form.Item
                            {...field}
                            label="Время старта"
                            name={[field.name, 'startTime']}
                            rules={[{ required: true, message: 'Выберите время' }]}
                          >
                            <Select
                              options={[
                                { value: '7:00', label: '07:00' },
                                { value: '7:30', label: '07:30' },
                                { value: '8:00', label: '08:00' },
                                { value: '8:30', label: '08:30' },
                                { value: '9:00', label: '09:00' },
                              ]}
                            />
                          </Form.Item>
                        </Space>
                      </Card>
                    ))}

                    <Space wrap>
                      <Button
                        onClick={() =>
                          add({
                            id: '',
                            number: '',
                            type: 'day' as const,
                            startTime: '8:00' as const,
                          })
                        }
                      >
                        Добавить бригаду
                      </Button>
                    </Space>
                  </Space>
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

