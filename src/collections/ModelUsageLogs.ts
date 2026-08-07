import type { CollectionConfig } from 'payload'

export const ModelUsageLogs: CollectionConfig = {
  slug: 'model-usage-logs',
  labels: {
    singular: '模型调用日志',
    plural: '模型调用日志',
  },
  admin: {
    useAsTitle: 'id',
    description: '记录每次模型调用的详细信息',
    defaultColumns: ['modelApi', 'status', 'tokens', 'duration', 'createdAt'],
  },
  fields: [
    {
      name: 'modelApi',
      type: 'relationship',
      relationTo: 'model-apis',
      required: true,
      label: '使用的模型',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: '成功', value: 'success' },
        { label: '失败', value: 'failed' },
      ],
      label: '调用状态',
    },
    {
      name: 'tokens',
      type: 'number',
      label: 'Token使用量',
    },
    {
      name: 'duration',
      type: 'number',
      label: '耗时（毫秒）',
    },
    {
      name: 'errorMessage',
      type: 'textarea',
      label: '错误信息',
      admin: {
        condition: (_, siblingData) => siblingData.status === 'failed',
      },
    },
    {
      name: 'purpose',
      type: 'select',
      options: [
        { label: '生成文章', value: 'generate_article' },
        { label: '生成文章(重试)', value: 'generate_article_retry' },
        { label: '生成标题', value: 'generate_title' },
        { label: '生成摘要', value: 'generate_excerpt' },
        { label: '生成内链', value: 'generate_internal_links' },
        { label: '扩词', value: 'expand_keywords' },
        { label: '其他', value: 'other' },
      ],
      label: '调用用途',
    },
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      label: '关联站点',
    },
    {
      name: 'article',
      type: 'relationship',
      relationTo: 'articles',
      label: '关联文章',
    },
  ],
}
