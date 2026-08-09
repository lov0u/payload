'use client'

import GenericListPage from '@/components/admin/pages/GenericListPage'
import type { ListColumn, FormField } from '@/components/admin/pages/GenericListPage'

const columns: ListColumn[] = [
  { title: '邮箱', dataIndex: 'email', width: 240 },
  { title: '角色', dataIndex: 'role', width: 120 },
  { title: '创建时间', dataIndex: 'createdAt', width: 180, sorter: true },
]

const formFields: FormField[] = [
  { name: 'email', label: '邮箱', type: 'input', required: true, placeholder: '请输入邮箱' },
  { name: 'password', label: '密码', type: 'input', required: true, placeholder: '请输入密码' },
  { name: 'name', label: '姓名', type: 'input', placeholder: '请输入姓名' },
]

export default function UsersPage() {
  return (
    <GenericListPage
      collection="users"
      title="用户管理"
      columns={columns}
      filterFields={[
        { name: 'email', label: '邮箱', type: 'input', placeholder: '搜索邮箱' },
      ]}
      formFields={formFields}
    />
  )
}
