import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: '用户',
    plural: '用户管理',
  },
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      options: [
        { label: '管理员', value: 'admin' },
        { label: '编辑', value: 'editor' },
      ],
      defaultValue: 'admin',
      required: true,
    },
  ],
}
