'use client'
import GenericListPage from '@/components/admin/pages/GenericListPage'
import type { ListColumn, FormField } from '@/components/admin/pages/GenericListPage'
const cols: ListColumn[] = [{ title: '标签名称', dataIndex: 'name', width: 200 }, { title: '标识', dataIndex: 'slug', width: 160 }]
const ff: FormField[] = [{ name: 'name', label: '标签名称', type: 'input', required: true }, { name: 'slug', label: '标识', type: 'input', required: true }]
export default function TagsPage() {
  return <GenericListPage collection="tags" title="标签管理" columns={cols} filterFields={[{ name: 'name', label: '标签', type: 'input', placeholder: '搜索标签' }]} formFields={ff} />
}
