'use client'

import { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic, Table, Typography, Tag, Spin } from 'antd'
import {
  GlobalOutlined, FileTextOutlined, KeyOutlined,
  ApiOutlined, FileAddOutlined, BarChartOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { getList } from '@/lib/admin-api'

const { Title, Text } = Typography

const COLORS = ['#1677FF', '#52C41A', '#FAAD14', '#722ED1', '#13C2C2', '#EB2F96', '#FA8C16', '#2F54EB']

interface DashboardStats {
  sites: number
  keywordsAvailable: number
  articlesTotal: number
  articlesToday: number
  models: number
  modelCalls: number
  successRate: number
}

const statCards = [
  { key: 'sites', title: '站点数量', icon: <GlobalOutlined />, color: '#1677FF', bg: '#E6F4FF' },
  { key: 'articlesTotal', title: '文章总数', icon: <FileTextOutlined />, color: '#52C41A', bg: '#F6FFED' },
  { key: 'keywordsAvailable', title: '可用关键词', icon: <KeyOutlined />, color: '#FAAD14', bg: '#FFFBE6' },
  { key: 'articlesToday', title: '今日生成', icon: <FileAddOutlined />, color: '#722ED1', bg: '#F9F0FF' },
  { key: 'models', title: '模型数量', icon: <ApiOutlined />, color: '#13C2C2', bg: '#E6FFFB' },
  { key: 'modelCalls', title: '模型调用', icon: <BarChartOutlined />, color: '#EB2F96', bg: '#FFF0F6' },
]

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    sites: 0, keywordsAvailable: 0, articlesTotal: 0,
    articlesToday: 0, models: 0, modelCalls: 0, successRate: 0,
  })
  const [loading, setLoading] = useState(true)
  const [siteChart, setSiteChart] = useState<{ name: string; value: number }[]>([])
  const [recentArticles, setRecentArticles] = useState<Record<string, unknown>[]>([])
  const [logChart, setLogChart] = useState<{ date: string; success: number; failed: number }[]>([])
  const [chartLoading, setChartLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      try {
        const [sitesRes, articlesRes, keywordsRes, modelsRes, logsRes, allArticlesRes, recentRes] = await Promise.all([
          getList('sites', { limit: '1' }),
          getList('articles', { limit: '1' }),
          getList('generate-keywords', { limit: '1' }),
          getList('model-apis', { limit: '1' }),
          getList('model-usage-logs', { limit: '1' }),
          getList('articles', { limit: '500', depth: '1', sort: '-createdAt' }),
          getList('articles', { limit: '10', depth: '1', sort: '-createdAt' }),
        ])

        const articles = allArticlesRes.docs || []
        const today = new Date().toISOString().split('T')[0]

        setStats({
          sites: sitesRes.totalDocs || 0,
          articlesTotal: articlesRes.totalDocs || 0,
          articlesToday: articles.filter((a: Record<string, unknown>) =>
            String(a.createdAt || '').startsWith(today)
          ).length,
          keywordsAvailable: keywordsRes.totalDocs || 0,
          models: modelsRes.totalDocs || 0,
          modelCalls: logsRes.totalDocs || 0,
          successRate: 0,
        })
        setRecentArticles(recentRes.docs || [])

        // Articles by site (for pie chart)
        const siteMap: Record<string, number> = {}
        articles.forEach((a: Record<string, unknown>) => {
          const siteName = (a.site as Record<string, string> | undefined)?.name || '未分配'
          siteMap[siteName] = (siteMap[siteName] || 0) + 1
        })
        const siteData = Object.entries(siteMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8)
        setSiteChart(siteData)

        // Daily generation for last 7 days
        const days: { date: string; success: number; failed: number }[] = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const ds = d.toISOString().split('T')[0]
          const dayArticles = articles.filter((a: Record<string, unknown>) =>
            String(a.createdAt || '').startsWith(ds)
          )
          days.push({ date: `${d.getMonth() + 1}/${d.getDate()}`, success: dayArticles.length, failed: 0 })
        }
        setLogChart(days)
      } catch (e) {
        console.error('Failed to load dashboard data', e)
      } finally {
        setLoading(false)
        setChartLoading(false)
      }
    }
    fetchAll()
  }, [])

  const articleColumns = [
    { title: '标题', dataIndex: 'title', width: 280, ellipsis: true,
      render: (v: string, r: Record<string, unknown>) => <a href={`https://${(r.site as Record<string,string>)?.domain || 'payload.ra0.cn'}/${r.slug}`} target="_blank" style={{ color: '#1677FF' }}>{v}</a>
    },
    { title: '站点', dataIndex: ['site', 'name'], width: 120, render: (v: unknown) => v || '-' },
    { title: '状态', dataIndex: 'status', width: 90,
      render: (v: string) => v === 'published'
        ? <Tag icon={<CheckCircleOutlined />} color="#52C41A" style={{ borderRadius: 4 }}>已发布</Tag>
        : <Tag icon={<ExclamationCircleOutlined />} color="#FAAD14" style={{ borderRadius: 4 }}>草稿</Tag>
    },
    { title: '浏览量', dataIndex: 'views', width: 80 },
    { title: '发布时间', dataIndex: 'publishedAt', width: 120, render: (v: string) => v ? new Date(v).toLocaleDateString('zh-CN') : '-' },
  ]

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, fontSize: 20, fontWeight: 500, color: '#18191C' }}>仪表盘</Title>
          <Text style={{ fontSize: 14, color: '#86909C' }}>欢迎回来，以下是系统运行概览</Text>
        </div>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statCards.map(card => (
          <Col xs={24} sm={12} lg={8} xl={4} key={card.key}>
            <Card loading={loading} style={{ borderRadius: 8 }} styles={{ body: { padding: '20px 24px' } }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Statistic
                  title={<span style={{ fontSize: 14, color: '#86909C' }}>{card.title}</span>}
                  value={stats[card.key as keyof DashboardStats]}
                  valueStyle={{ fontSize: 30, fontWeight: 600, color: '#18191C' }}
                />
                <div style={{
                  width: 48, height: 48, borderRadius: 12, background: card.bg, color: card.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                }}>
                  {card.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 图表区 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* 文章站点分布 - 饼图 */}
        <Col xs={24} lg={12}>
          <Card
            title={<span style={{ fontSize: 16, fontWeight: 500 }}>文章站点分布</span>}
            loading={chartLoading}
            style={{ borderRadius: 8 }}
            styles={{ body: { padding: '16px 8px 8px' } }}
          >
            {siteChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={siteChart}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={{ stroke: '#86909C' }}
                  >
                    {siteChart.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, _name: string) => [`${value} 篇`, '文章数']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#86909C' }}>暂无数据</div>
            )}
          </Card>
        </Col>

        {/* 每日生成趋势 - 柱状图 */}
        <Col xs={24} lg={12}>
          <Card
            title={<span style={{ fontSize: 16, fontWeight: 500 }}>近7日文章生成趋势</span>}
            loading={chartLoading}
            style={{ borderRadius: 8 }}
            styles={{ body: { padding: '16px 8px 8px' } }}
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={logChart} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#86909C' }} />
                <YAxis tick={{ fontSize: 12, fill: '#86909C' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 6, border: '1px solid #E5E6EB' }}
                  formatter={(value: number) => [`${value} 篇`, '生成数量']}
                />
                <Bar dataKey="success" fill="#1677FF" radius={[4, 4, 0, 0]} name="文章数" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* 最近文章 */}
      <Card
        title={<span style={{ fontSize: 16, fontWeight: 500 }}>最近文章</span>}
        loading={chartLoading}
        style={{ borderRadius: 8 }}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          columns={articleColumns}
          dataSource={recentArticles}
          rowKey="id"
          pagination={false}
          style={{ padding: '0 24px' }}
          size="middle"
        />
      </Card>
    </div>
  )
}
