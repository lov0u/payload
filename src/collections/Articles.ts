import type { CollectionConfig } from 'payload'

export const Articles: CollectionConfig = {
  slug: 'articles',
  access: {
    read: ({ req: { user } }) => {
      if (user) return true
      return {
        status: { equals: 'published' }
      }
    },
    create: ({ req: { user } }) => {
      return !!user
    },
    update: ({ req: { user } }) => {
      return !!user
    },
    delete: ({ req: { user } }) => {
      return !!user
    },
  },
  labels: {
    singular: '文章',
    plural: '文章管理',
  },
  admin: {
    useAsTitle: 'title',
    description: '文章管理',
    defaultColumns: ['title', 'site', 'status', 'publishedAt'],
  },
  versions: {
    drafts: true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: '文章标题',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      label: '文章别名',
    },
    {
      name: 'content',
      type: 'textarea',
      label: '文章内容',
      required: true,
    },
    {
      name: 'excerpt',
      type: 'textarea',
      label: '摘要',
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
      label: '封面图',
    },
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      required: true,
      label: '所属站点',
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      label: '分类',
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      label: '标签',
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: '草稿', value: 'draft' },
        { label: '已发布', value: 'published' },
      ],
      defaultValue: 'published',
      label: '状态',
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: '发布时间',
    },
    {
      name: 'sourceKeyword',
      type: 'text',
      label: '来源关键词',
    },
    {
      name: 'metaTitle',
      type: 'text',
      label: 'SEO 标题',
    },
    {
      name: 'metaDescription',
      type: 'textarea',
      label: 'SEO 描述',
    },
    {
      name: 'metaKeywords',
      type: 'text',
      label: 'SEO 关键词',
    },
    {
      name: 'internalLinks',
      type: 'textarea',
      label: '内链 HTML',
      admin: {
        description: '文章内链的 HTML 片段',
      },
    },
    {
      name: 'jsonLd',
      type: 'textarea',
      label: 'JSON-LD 结构化数据',
      admin: {
        description: 'Schema.org 结构化数据（自动生成，用于AI搜索引擎收录）',
      },
    },
    {
      name: 'views',
      type: 'number',
      defaultValue: 0,
      label: '浏览量',
    },
  ],
}
