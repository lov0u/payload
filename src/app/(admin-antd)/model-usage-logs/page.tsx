'use client'
import { Tag } from 'antd'
import GenericListPage from '@/components/admin/pages/GenericListPage'
import type { ListColumn } from '@/components/admin/pages/GenericListPage'
const sc: Record<string, string> = { success: '#52C41A', error: '#FF4D4F' }
const cols: ListColumn[] = [
  { title: '模型', dataIndex: 'modelApi', width: 160 },
  { title: '状态', dataIndex: 'status', width: 100, render: (v: unknown) => <Tag color={sc[String(v)] || '#86909C'} style={{ borderRadius: 4 }}>{String(v)}</Tag> },
  { title: 'Tokens', dataIndex: 'tokens', width: 100 },
  { title: '耗时', dataIndex: 'duration', width: 100 },
  { title: '时间', dataIndex: 'createdAt', width: 180, sorter: true },
]
export default function ModelUsageLogsPage() {
  return <GenericListPage collection="model-usage-logs" title="调用日志" columns={cols} sortField="createdAt" hideCreate />
}
