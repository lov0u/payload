'use client'
import GenericListPage from '@/components/admin/pages/GenericListPage'
import type { ListColumn, FormField } from '@/components/admin/pages/GenericListPage'
const cols: ListColumn[] = [
  { title: '名称', dataIndex: 'name', width: 160 }, { title: '模型', dataIndex: 'model', width: 160 },
  { title: 'API URL', dataIndex: 'apiUrl', width: 280 }, { title: '调用次数', dataIndex: 'totalCalls', width: 100 },
]
const ff: FormField[] = [
  { name: 'name', label: '名称', type: 'input', required: true }, { name: 'model', label: '模型标识', type: 'input', required: true },
  { name: 'apiUrl', label: 'API 地址', type: 'input', required: true }, { name: 'apiKey', label: 'API Key', type: 'textarea' },
  { name: 'order', label: '排序', type: 'number' },
]
export default function ModelApisPage() {
  return <GenericListPage collection="model-apis" title="模型API" columns={cols} formFields={ff} testButton={{ api: '/api/model-test', label: '测试' }} />
}
