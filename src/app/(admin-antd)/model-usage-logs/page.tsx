'use client'
import { useEffect, useState } from 'react'
import { Card, Table, Row, Col, Statistic, Select, Tag, Spin, message, Progress } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { getToken } from '@/lib/admin-api'

interface DailyRow {
  date: string
  total: number
  success: number
  failed: number
  tokens: number
  successRate: number
}
interface Summary {
  total: number
  success: number
  failed: number
  totalTokens: number
  avgSuccessRate: number
  days: number
}

function rateColor(r: number) {
  if (r >= 99) return '#52C41A'
  if (r >= 90) return '#FAAD14'
  return '#FF4D4F'
}

export default function ModelUsageLogsPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<DailyRow[]>([])
  const [summary, setSummary] = useState<Summary>({ total: 0, success: 0, failed: 0, totalTokens: 0, avgSuccessRate: 100, days: 30 })
  const [days, setDays] = useState(30)

  const load = async (d: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/usage-stats?days=${d}`, {
        headers: { ...(getToken() ? { Authorization: `JWT ${getToken()}` } : {}) },
      })
      const data = await res.json() as { daily: DailyRow[]; summary: Summary; error?: string }
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      setRows(data.daily || [])
      setSummary(data.summary || summary)
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(days) }, [days])

  const columns: ColumnsType<DailyRow> = [
    { title: '日期', dataIndex: 'date', width: 140, render: (v: string) => <span style={{ color: '#18191C' }}>{v}</span> },
    { title: '调用次数', dataIndex: 'total', width: 120, sorter: (a, b) => a.total - b.total },
    { title: '成功', dataIndex: 'success', width: 100, render: (v: number) => <span style={{ color: '#52C41A' }}>{v}</span> },
    { title: '失败', dataIndex: 'failed', width: 100, render: (v: number) => <span style={{ color: v ? '#FF4D4F' : '#86909C' }}>{v}</span> },
    {
      title: 'Token用量',
      dataIndex: 'tokens',
      width: 140,
      sorter: (a, b) => a.tokens - b.tokens,
      render: (v: number) => <span style={{ color: '#18191C' }}>{v.toLocaleString()}</span>,
    },
    {
      title: '成功率',
      dataIndex: 'successRate',
      width: 220,
      sorter: (a, b) => a.successRate - b.successRate,
      render: (v: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Progress
            percent={v}
            size="small"
            strokeColor={rateColor(v)}
            style={{ width: 120, margin: 0 }}
            format={(p) => `${p}%`}
          />
          <Tag color={rateColor(v)} style={{ borderRadius: 4 }}>{v}%</Tag>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <span style={{ fontSize: 20, fontWeight: 500, color: '#18191C' }}>调用日志统计</span>
        <Select
          value={days}
          onChange={(v) => setDays(v)}
          style={{ width: 140 }}
          options={[
            { label: '近 7 天', value: 7 },
            { label: '近 14 天', value: 14 },
            { label: '近 30 天', value: 30 },
            { label: '近 90 天', value: 90 },
          ]}
        />
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col style={{ flex: 1, minWidth: 0 }}>
          <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 20 } }}>
            <Statistic title="总调用次数" value={summary.total} valueStyle={{ color: '#1677FF' }} />
          </Card>
        </Col>
        <Col style={{ flex: 1, minWidth: 0 }}>
          <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 20 } }}>
            <Statistic title="成功" value={summary.success} valueStyle={{ color: '#52C41A' }} />
          </Card>
        </Col>
        <Col style={{ flex: 1, minWidth: 0 }}>
          <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 20 } }}>
            <Statistic title="失败" value={summary.failed} valueStyle={{ color: summary.failed ? '#FF4D4F' : undefined }} />
          </Card>
        </Col>
        <Col style={{ flex: 1, minWidth: 0 }}>
          <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 20 } }}>
            <Statistic title="平均成功率" value={summary.avgSuccessRate} suffix="%" valueStyle={{ color: rateColor(summary.avgSuccessRate) }} />
          </Card>
        </Col>
        <Col style={{ flex: 1, minWidth: 0 }}>
          <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 20 } }}>
            <Statistic title="总 Token 用量" value={summary.totalTokens} valueStyle={{ color: '#722ED1' }} />
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #F0F0F0', color: '#86909C', fontSize: 14 }}>
          每日调用明细（成功 / 失败 / Token用量 / 成功率）
        </div>
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={rows}
            rowKey="date"
            pagination={rows.length > 14 ? { pageSize: 14, showTotal: (t: number) => `共 ${t} 天` } : false}
            style={{ padding: '0 24px' }}
          />
        </Spin>
      </Card>
    </div>
  )
}
