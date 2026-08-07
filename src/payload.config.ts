import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media],
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
  ],
  csrf: [
    process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
    'https://payload.ra0.cn',
  ],
  sharp,
})
