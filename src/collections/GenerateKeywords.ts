import type { CollectionConfig } from 'payload'

export const GenerateKeywords: CollectionConfig = {
  slug: 'generate-keywords',
  labels: {
    singular: '关键词',
    plural: '关键词管理',
  },
  admin: {
    group: '生成引擎',
    useAsTitle: 'keyword',
    description: '关键词管理',
    defaultColumns: ['keyword', 'keywordType', 'status', 'site', 'sourceType'],
  },
  fields: [
    {
      name: 'keyword',
      type: 'text',
      required: true,
      label: '关键词',
    },
    {
      name: 'keywordType',
      type: 'select',
      options: [
        { label: '种子词', value: 'seed' },
        { label: '长尾词', value: 'longtail' },
      ],
      defaultValue: 'seed',
      label: '关键词类型',
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: '待使用', value: 'pending' },
        { label: '已占用', value: 'reserved' },
        { label: '已使用', value: 'used' },
        { label: '已禁用', value: 'disabled' },
      ],
      defaultValue: 'pending',
      label: '状态',
    },
    {
      name: 'sourceType',
      type: 'select',
      options: [
        { label: '手动导入', value: 'manual' },
        { label: '百度相关搜索', value: 'baidu_related' },
        { label: '百度热词', value: 'baidu_hot' },
        { label: 'AI 扩展', value: 'ai_expanded' },
      ],
      defaultValue: 'manual',
      label: '来源类型',
    },
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      required: true,
      label: '所属站点',
    },
    {
      name: 'parentKeyword',
      type: 'relationship',
      relationTo: 'generate-keywords',
      label: '父关键词（种子词）',
    },
    {
      name: 'usedAt',
      type: 'date',
      label: '使用时间',
    },
    {
      name: 'articleId',
      type: 'text',
      label: '生成的文章 ID',
    },
    {
      name: 'similarityScore',
      type: 'number',
      label: '相似度分数',
    },
  ],
}
