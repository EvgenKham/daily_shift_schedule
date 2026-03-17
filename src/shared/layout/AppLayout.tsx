import { InfoCircleOutlined } from '@ant-design/icons'
import { Layout, Menu, Space, Typography } from 'antd'
import type { MenuProps } from 'antd'
import { Link, Outlet, useLocation } from 'react-router-dom'

const { Header, Content, Footer } = Layout

const menuItems: MenuProps['items'] = [
  { key: '/', label: <Link to="/">Главная</Link> },
  { key: '/roster', label: <Link to="/roster">Наряд</Link> },
  { key: '/schedule', label: <Link to="/schedule">График</Link> },
  { key: '/settings', label: <Link to="/settings">Настройки</Link> },
  { key: '/help', label: <Link to="/help">Помощь</Link> },
  { key: '/about', label: <Link to="/about">О нас</Link> },
]

function getSelectedKey(pathname: string) {
  const known = new Set(menuItems?.map((i) => (i ? String(i.key) : '')) ?? [])
  if (known.has(pathname)) return pathname
  const first = `/${pathname.split('/').filter(Boolean)[0] ?? ''}`
  return known.has(first) ? first : '/'
}

export function AppLayout() {
  const { pathname } = useLocation()

  return (
    <Layout style={{ minHeight: '100%' }}>
      <Header style={{ paddingInline: 16, display: 'flex', alignItems: 'center' }}>
        <Space style={{ minWidth: 240 }}>
          <InfoCircleOutlined style={{ color: '#fff' }} />
          <Typography.Text style={{ color: '#fff' }} strong>
            Daily Shift Schedule
          </Typography.Text>
        </Space>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[getSelectedKey(pathname)]}
          items={menuItems}
          style={{ flex: 1, minWidth: 0 }}
        />
      </Header>
      <Content style={{ padding: 16 }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <Outlet />
        </div>
      </Content>
      <Footer style={{ textAlign: 'center' }}>
        <Typography.Text type="secondary">
          SMP • Daily Shift Schedule • Offline-first (IndexedDB)
        </Typography.Text>
      </Footer>
    </Layout>
  )
}

