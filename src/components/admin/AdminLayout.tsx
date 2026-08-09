'use client'

import React, { useState, useEffect } from 'react'
import { Layout, Menu, Avatar, Dropdown, Badge, Typography } from 'antd'
import {
  DashboardOutlined,
  UserOutlined,
  FileTextOutlined,
  PictureOutlined,
  GlobalOutlined,
  TagsOutlined,
  AppstoreOutlined,
  SettingOutlined,
  KeyOutlined,
  FileSearchOutlined,
  LogoutOutlined,
  RobotOutlined,
  ApiOutlined,
  BarChartOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
} from '@ant-design/icons'
import { useRouter, usePathname } from 'next/navigation'
import { logout, getToken, getOne } from '@/lib/admin-api'

const { Header, Sider, Content } = Layout
const { Text } = Typography

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { type: 'group' as const, label: '内容' },
  { key: '/articles', icon: <FileTextOutlined />, label: '文章管理' },
  { key: '/categories', icon: <AppstoreOutlined />, label: '分类管理' },
  { key: '/tags', icon: <TagsOutlined />, label: '标签管理' },
  { key: '/media', icon: <PictureOutlined />, label: '媒体库' },
  { type: 'group' as const, label: '生成引擎' },
  { key: '/generate-configs', icon: <SettingOutlined />, label: '生成配置' },
  { key: '/generate-keywords', icon: <KeyOutlined />, label: '关键词管理' },
  { key: '/generate-logs', icon: <FileSearchOutlined />, label: '生成日志' },
  { type: 'group' as const, label: '模型' },
  { key: '/model-apis', icon: <ApiOutlined />, label: '模型API' },
  { key: '/model-usage-logs', icon: <BarChartOutlined />, label: '调用日志' },
  { type: 'group' as const, label: '工具' },
  { key: '/article-generator', icon: <RobotOutlined />, label: '文章生成器' },
  { type: 'group' as const, label: '系统' },
  { key: '/users', icon: <UserOutlined />, label: '用户管理' },
  { key: '/sites', icon: <GlobalOutlined />, label: '站点管理' },
]

function findMenuLabel(key: string): string {
  for (const m of menuItems) {
    if ('key' in m && m.key === key) return String(m.label ?? '')
  }
  return ''
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [user, setUser] = useState<{ email?: string; name?: string }>({})
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login-antd')
      return
    }
    getOne('users', 'me').then(data => {
      setUser(data.user || data)
    }).catch(() => {})
  }, [])

  const handleMenuClick = ({ key }: { key: string }) => router.push(key)

  const handleLogout = async () => {
    logout()
    router.replace('/login-antd')
  }

  const userMenuItems = {
    items: [
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
    ],
    onClick: ({ key }: { key: string }) => { if (key === 'logout') handleLogout() },
  }

  // Determine selected menu key
  const pathSeg = '/' + (pathname?.split('/').filter(Boolean)[0] || '')
  const selectedKey = pathSeg
  const pageLabel = findMenuLabel(selectedKey) || '仪表盘'
  const breadcrumbLabel = selectedKey === '/' ? '仪表盘' : pageLabel

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* ====== 侧边栏 Sidebar 240px ====== */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={240}
        style={{
          background: '#FFFFFF',
          borderRight: '1px solid #F0F0F0',
        }}
      >
        {/* 品牌区 64px */}
        <div style={{
          height: 64, display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 24px',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6, background: '#1677FF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#FFFFFF', fontWeight: 600, fontSize: 18, flexShrink: 0,
          }}>
            P
          </div>
          {!collapsed && (
            <span style={{
              marginLeft: 10, fontSize: 16, fontWeight: 600, color: '#18191C',
              whiteSpace: 'nowrap',
            }}>
              Payload CMS
            </span>
          )}
        </div>

        {/* 导航菜单 */}
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ border: 'none', marginTop: 4 }}
        />

        {/* 底部用户区 */}
        {!collapsed && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '12px 24px', borderTop: '1px solid #F2F3F5',
            display: 'flex', alignItems: 'center', background: '#FFFFFF',
          }}>
            <Avatar size={36} style={{ background: '#1677FF' }} icon={<UserOutlined />} />
            <div style={{ marginLeft: 10, flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#18191C' }}>
                {user.email || '管理员'}
              </div>
              <div style={{ fontSize: 12, color: '#86909C' }}>超级管理员</div>
            </div>
          </div>
        )}
      </Sider>

      <Layout>
        {/* ====== 顶栏 Topbar 56px ====== */}
        <Header style={{
          background: '#FFFFFF', padding: '0 24px', height: 56,
          borderBottom: '1px solid #E5E6EB',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          lineHeight: '56px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
              style: { fontSize: 18, cursor: 'pointer', color: '#4E5969' },
              onClick: () => setCollapsed(!collapsed),
            })}
            <span style={{ fontSize: 14, color: '#86909C' }}>
              首页 / {breadcrumbLabel}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Badge dot offset={[-2, 4]}>
              <BellOutlined style={{ fontSize: 18, color: '#86909C', cursor: 'pointer' }} />
            </Badge>
            <Dropdown menu={userMenuItems} placement="bottomRight">
              <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
                <Avatar size={32} style={{ background: '#1677FF' }} icon={<UserOutlined />} />
                <Text style={{ fontSize: 14, color: '#4E5969' }}>{user.email || '管理员'}</Text>
              </div>
            </Dropdown>
          </div>
        </Header>

        {/* ====== 内容区 ====== */}
        <Content style={{ margin: 24, minHeight: 280 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}
