'use client'
import { Typography } from 'antd'
const { Title } = Typography
export default function ArticleGeneratorPage() {
  return (
    <div>
      <Title level={4} style={{ fontSize: 20, fontWeight: 500, color: '#18191C' }}>文章生成器</Title>
      <p style={{ color: '#86909C', marginTop: 8 }}>
        此功能将在后续版本中完善。目前请使用 Payload 原生后台的文章生成器。
      </p>
    </div>
  )
}
