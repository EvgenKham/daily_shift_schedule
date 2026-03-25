import { Alert, Button, Card, DatePicker, Space, Table, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import dayjs from 'dayjs'

type Row = {
  key: string
  brigade: string
  shift: 'day' | 'night'
  composition: string
}

const columns: TableColumnsType<Row> = [
  { title: 'Бригада', dataIndex: 'brigade', key: 'brigade', width: 160 },
  {
    title: 'Смена',
    dataIndex: 'shift',
    key: 'shift',
    width: 120,
    render: (v: Row['shift']) => (v === 'day' ? <Tag color="blue">День</Tag> : <Tag color="purple">Ночь</Tag>),
  },
  { title: 'Состав', dataIndex: 'composition', key: 'composition' },
]

export function RosterPage() {
  const data: Row[] = []

  return (
    <Space orientation="vertical" size={16} style={{ display: 'flex' }}>
      <Card title="Наряд (день/ночь)">
        <Space orientation="vertical" size={12} style={{ display: 'flex' }}>
          <Space wrap>
            <DatePicker defaultValue={dayjs()} />
            <Button type="primary" disabled>
              Сгенерировать
            </Button>
            <Button disabled>Сохранить</Button>
            <Button disabled>Скачать XLSX</Button>
          </Space>

          <Alert
            type="warning"
            showIcon
            message="Здесь будет таблица наряда с редактированием и drag&drop. Пока это UI-заготовка."
          />
        </Space>
      </Card>

      <Card
        title="Таблица наряда"
        extra={<Typography.Text type="secondary">Редактирование появится в следующих задачах</Typography.Text>}
      >
        <Table<Row>
          columns={columns}
          dataSource={data}
          pagination={false}
          locale={{ emptyText: 'Нет данных — сначала загрузите график и нажмите «Сгенерировать»' }}
        />
      </Card>
    </Space>
  )
}

