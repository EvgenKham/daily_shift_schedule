import { Card, Space, Typography } from 'antd'

export function HelpPage() {
  return (
    <Space orientation="vertical" size={16} style={{ display: 'flex' }}>
      <Card title="Помощь">
        <Typography.Paragraph>
          Это приложение помогает сформировать «наряд» по ежедневным сменам на основе загруженного графика месяца.
        </Typography.Paragraph>
        <Typography.Title level={5}>Как пользоваться (MVP)</Typography.Title>
        <ol>
          <li>Откройте «Настройки» и заполните базовые параметры подстанции и бригад.</li>
          <li>На странице «График» выберите месяц и загрузите XLSX графика.</li>
          <li>На странице «Наряд» выберите дату и нажмите «Сгенерировать».</li>
          <li>При необходимости вручную отредактируйте составы и скачайте XLSX.</li>
        </ol>
        <Typography.Paragraph type="secondary">
          Сейчас часть функционала ещё в разработке — страницы собраны как UI-каркас.
        </Typography.Paragraph>
      </Card>
    </Space>
  )
}

