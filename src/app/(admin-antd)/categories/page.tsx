'use client'
import GenericListPage from '@/components/admin/pages/GenericListPage'
import type { ListColumn, FormField } from '@/components/admin/pages/GenericListPage'
const columns: ListColumn[] = [{ title: '分类名称', dataIndex: 'name', width: 200 }, { title: '标识', dataIndex: 'slug', width: 160 }]
const formFields: FormField[] = [{ name: 'name', label: '分类名称', type: 'input', required: true }, { name: 'slug', label: '标识', type: 'input', required: true }, { name: 'description', label: '描述', type: 'textarea' }]
export default function CategoriesPage() {
  return <GenericListPage collection="categories" title="分类管理" columns={columns} filterFields={[{ name: 'name', label: '分类', type: 'input', placeholder: '搜索分类' }]} formFields={formFields} />
}
