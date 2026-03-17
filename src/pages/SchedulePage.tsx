import { Alert, Button, Card, DatePicker, Empty, Space, Statistic, Upload } from 'antd'
import type { UploadProps } from 'antd'
import dayjs from 'dayjs'

export function SchedulePage() {
  const uploadProps: UploadProps = {
    accept: '.xlsx,.xls',
    beforeUpload: () => false,
    showUploadList: true,
  }

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Card title="График (месяц)">
        <Space direction="vertical" size={12} style={{ display: 'flex' }}>
          <Space wrap>
            <DatePicker picker="month" defaultValue={dayjs()} />
            <Upload {...uploadProps}>
              <Button>Загрузить XLSX</Button>
            </Upload>
            <Button disabled>Скачать шаблон</Button>
            <Button danger disabled>
              Удалить график
            </Button>
            <Button disabled>Обновить</Button>
          </Space>

          <Alert
            type="info"
            showIcon
            message="UI готов. Парсер XLSX и IndexedDB будут подключены в следующих задачах."
          />

          <Space wrap>
            <Statistic title="Сотрудников" value="—" />
            <Statistic title="Смен (нормализовано)" value="—" />
          </Space>
        </Space>
      </Card>

      <Card title="Проблемы парсинга / валидации">
        <Empty description="Нет данных" />
      </Card>
    </Space>
  )
}

