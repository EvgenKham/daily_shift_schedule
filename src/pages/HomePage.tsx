import { Button, Card, Col, Empty, Row, Space, Statistic, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { loadJson } from '../shared/storage/localStorageJson'
import { getGreeting } from '../shared/time/greeting'

type Settings = {
  userName: string
  substationNumber: number | null
  brigades: unknown[]
}

const STORAGE_KEY = 'dss_settings_v1'

export function HomePage() {
  const now = new Date()
  const settings = loadJson<Settings>(STORAGE_KEY)
  const userName = settings?.userName?.trim() || '—'
  const substation =
    settings?.substationNumber != null ? `№ ${settings.substationNumber}` : '—'
  const brigadesCount = Array.isArray(settings?.brigades)
    ? settings?.brigades.length
    : null

  return (
    <Space orientation="vertical" size={16} style={{ display: 'flex' }}>
      <Card>
        <Space orientation="vertical" size={8} style={{ display: 'flex' }}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {getGreeting(now)}!
          </Typography.Title>
          <Typography.Text type="secondary">
            Сегодня: {now.toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </Typography.Text>
          <Space wrap>
            <Button type="primary">
              <Link to="/roster">Начать работу</Link>
            </Button>
            <Button>
              <Link to="/settings">Открыть настройки</Link>
            </Button>
          </Space>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Подстанция" value={substation} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Бригад (настроено)"
              value={brigadesCount ?? '—'}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Пользователь" value={userName} />
          </Card>
        </Col>
      </Row>

      <Card title="Последние действия">
        <Empty description="Пока пусто (лог появится после добавления IndexedDB)" />
      </Card>
    </Space>
  )
}

