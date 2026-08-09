'use client'
import { Image } from 'antd'
import GenericListPage from '@/components/admin/pages/GenericListPage'
import type { ListColumn } from '@/components/admin/pages/GenericListPage'
const cols: ListColumn[] = [
  { title: '预览', dataIndex: 'url', width: 100, render: (v: unknown) => v ? <Image src={String(v)} width={60} height={40} style={{ objectFit: 'cover', borderRadius: 4 }} /> : null },
  { title: '文件名', dataIndex: 'filename', width: 280 },
  { title: '类型', dataIndex: 'mimeType', width: 160 },
  { title: '大小', dataIndex: 'filesize', width: 100 },
]
export default function MediaPage() {
  return <GenericListPage collection="media" title="媒体库" columns={cols} hideCreate />
}
