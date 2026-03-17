import { Button, Card, Col, Empty, Row, Space, Statistic, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { getGreeting } from '../shared/time/greeting'

export function HomePage() {
  const now = new Date()

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Card>
        <Space direction="vertical" size={8} style={{ display: 'flex' }}>
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
            <Statistic title="Подстанция" value="—" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Бригад (настроено)" value="—" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Пользователь" value="—" />
          </Card>
        </Col>
      </Row>

      <Card title="Последние действия">
        <Empty description="Пока пусто (лог появится после добавления IndexedDB)" />
      </Card>
    </Space>
  )
}

