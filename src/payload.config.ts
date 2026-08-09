import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Sites } from './collections/Sites'
import { Categories } from './collections/Categories'
import { Tags } from './collections/Tags'
import { Articles } from './collections/Articles'
import { GenerateConfigs } from './collections/GenerateConfigs'
import { GenerateKeywords } from './collections/GenerateKeywords'
import { GenerateLogs } from './collections/GenerateLogs'
import { ModelAPIs } from './collections/ModelAPIs'
import { ModelUsageLogs } from './collections/ModelUsageLogs'

import { initGenerationCron } from './cron/generationCron'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: ' | Payload 管理后台',
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      views: {
        'article-generator': {
          Component: '/views/ArticleGenerator/Dashboard',
        },
      },
    },
  },
  collections: [
    Users,
    Media,
    Sites,
    Categories,
    Tags,
    Articles,
    GenerateConfigs,
    GenerateKeywords,
    GenerateLogs,
    ModelAPIs,
    ModelUsageLogs,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-in-production',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || 'postgres://payload:payloadpass123@localhost:5432/payload',
    },
    push: true,
  }),
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
  cors: [
    process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
    'https://payload.ra0.cn',
    'https://lov0u.cn',
    'https://yushitou.cn',
    'https://saituqimao.cn',
    'https://zsina.cn',
    'https://tandou518.cn',
    'https://xsc888.cn',
  ],
  csrf: [
    process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
    'https://payload.ra0.cn',
    'https://lov0u.cn',
    'https://yushitou.cn',
    'https://saituqimao.cn',
    'https://zsina.cn',
    'https://tandou518.cn',
    'https://xsc888.cn',
  ],
  onInit: async (payload) => {
    await initGenerationCron(payload)
  },
  sharp,
})
