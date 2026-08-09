'use client'
import { Tag, Tooltip } from 'antd'
import GenericListPage from '@/components/admin/pages/GenericListPage'
import type { ListColumn } from '@/components/admin/pages/GenericListPage'
import { getArticleUrl } from '@/lib/admin-api'

const statusMap: Record<string, { color: string; text: string }> = {
  published: { color: '#52C41A', text: '已发布' },
  draft: { color: '#FAAD14', text: '草稿' },
}

const columns: ListColumn[] = [
  { title: '标题', dataIndex: 'title', width: 280 },
  {
    title: '状态', dataIndex: 'status', width: 100,
    render: (v: unknown) => {
      const s = statusMap[String(v)] || { color: '#86909C', text: String(v) }
      return <Tag color={s.color} style={{ borderRadius: 4 }}>{s.text}</Tag>
    },
  },
  { title: '浏览量', dataIndex: 'views', width: 80, sorter: true },
  { title: '发布时间', dataIndex: 'publishedAt', width: 180, sorter: true },
]
export default function ArticlesPage() {
  return (
    <GenericListPage
      collection="articles" title="文章管理" columns={columns}
      filterFields={[{ name: 'title', label: '标题', type: 'input', placeholder: '搜索标题' }]}
      sortField="createdAt"
      onRowClick={record => window.open(getArticleUrl(record), '_blank')}
    />
  )
}
