import { Card, Descriptions, Space, Typography } from 'antd'

export function AboutPage() {
  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Card title="О нас">
        <Typography.Paragraph>
          Daily Shift Schedule — локальное офлайн‑приложение для подготовки нарядов (день/ночь) на основе месячного
          графика смен.
        </Typography.Paragraph>

        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="Стек">React + Vite + TypeScript + Ant Design</Descriptions.Item>
          <Descriptions.Item label="Хранение">IndexedDB (позже), сейчас настройки — localStorage</Descriptions.Item>
          <Descriptions.Item label="Экспорт">XLSX (SheetJS)</Descriptions.Item>
        </Descriptions>

        <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
          Если хотите — добавлю ссылку на спеку/пример и версию приложения в футер.
        </Typography.Paragraph>
      </Card>
    </Space>
  )
}

