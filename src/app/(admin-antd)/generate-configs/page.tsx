'use client'
import { Tag } from 'antd'
import GenericListPage from '@/components/admin/pages/GenericListPage'
import type { ListColumn, FormField } from '@/components/admin/pages/GenericListPage'
const cols: ListColumn[] = [
  { title: '配置名称', dataIndex: 'name', width: 200 },
  { title: '每日数量', dataIndex: 'dailyCount', width: 100 },
  { title: '启用', dataIndex: 'enabled', width: 80, render: (v: unknown) => v ? <Tag color="#52C41A" style={{ borderRadius: 4 }}>启用</Tag> : <Tag style={{ borderRadius: 4 }}>停用</Tag> },
  { title: 'Cron', dataIndex: 'cronExpression', width: 140 },
]
const ff: FormField[] = [
  { name: 'name', label: '配置名称', type: 'input', required: true },
  { name: 'dailyCount', label: '每日生成数量', type: 'number', required: true },
  { name: 'cronExpression', label: 'Cron 表达式', type: 'input' },
  { name: 'site_keywords', label: '站点关键词', type: 'textarea' },
  { name: 'custom_prompt', label: '自定义 Prompt', type: 'textarea' },
]
export default function GenerateConfigsPage() {
  return <GenericListPage collection="generate-configs" title="生成配置" columns={cols} formFields={ff} />
}
