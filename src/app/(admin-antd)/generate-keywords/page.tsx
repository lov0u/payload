'use client'
import { Tag } from 'antd'
import GenericListPage from '@/components/admin/pages/GenericListPage'
import type { ListColumn } from '@/components/admin/pages/GenericListPage'
const statusColors: Record<string, string> = { pending: '#FAAD14', used: '#52C41A', recycled: '#1677FF', failed: '#FF4D4F' }
const cols: ListColumn[] = [
  { title: '关键词', dataIndex: 'keyword', width: 200 },
  { title: '类型', dataIndex: 'keywordType', width: 100 },
  { title: '状态', dataIndex: 'status', width: 100, render: (v: unknown) => <Tag color={statusColors[String(v)] || '#86909C'} style={{ borderRadius: 4 }}>{String(v)}</Tag> },
]
export default function GenerateKeywordsPage() {
  return <GenericListPage collection="generate-keywords" title="关键词管理" columns={cols} sortField="createdAt" />
}
