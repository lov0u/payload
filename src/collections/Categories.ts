import type { CollectionConfig } from 'payload'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    read: () => true,
  },
  labels: {
    singular: '分类',
    plural: '文章分类',
  },
  admin: {
    group: '内容',
    useAsTitle: 'name',
    description: '文章分类',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: '分类名称',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      label: '分类别名',
    },
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      required: true,
      label: '所属站点',
    },
    {
      name: 'description',
      type: 'textarea',
      label: '分类描述',
    },
  ],
}
