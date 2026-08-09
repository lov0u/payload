'use client'
import { Tag } from 'antd'
import GenericListPage from '@/components/admin/pages/GenericListPage'
import type { ListColumn } from '@/components/admin/pages/GenericListPage'
const sc: Record<string, string> = { success: '#52C41A', running: '#1677FF', failed: '#FF4D4F' }
const cols: ListColumn[] = [
  { title: '关键词', dataIndex: 'keyword', width: 180 },
  { title: '状态', dataIndex: 'status', width: 100, render: (v: unknown) => <Tag color={sc[String(v)] || '#86909C'} style={{ borderRadius: 4 }}>{String(v)}</Tag> },
  { title: '耗时', dataIndex: 'duration', width: 100 },
  { title: '时间', dataIndex: 'createdAt', width: 180, sorter: true },
]
export default function GenerateLogsPage() {
  return <GenericListPage collection="generate-logs" title="生成日志" columns={cols} sortField="createdAt" hideCreate />
}
