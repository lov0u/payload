'use client'
import GenericListPage from '@/components/admin/pages/GenericListPage'
import type { ListColumn, FormField } from '@/components/admin/pages/GenericListPage'

const columns: ListColumn[] = [
  { title: '站点名称', dataIndex: 'name', width: 160 },
  { title: '域名', dataIndex: 'domain', width: 200 },
  { title: '行业', dataIndex: 'industry', width: 120 },
  { title: '标识', dataIndex: 'slug', width: 120 },
]
const formFields: FormField[] = [
  { name: 'name', label: '站点名称', type: 'input', required: true },
  { name: 'slug', label: '站点标识', type: 'input', required: true },
  { name: 'domain', label: '域名', type: 'input' },
  { name: 'description', label: '站点描述', type: 'textarea' },
  { name: 'industry', label: '行业', type: 'input' },
]
export default function SitesPage() {
  return <GenericListPage collection="sites" title="站点管理" columns={columns} filterFields={[{ name: 'name', label: '站点', type: 'input', placeholder: '搜索站点' }]} formFields={formFields} />
}
