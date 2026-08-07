import type { Payload } from 'payload'

export interface PickKeywordOptions {
  siteId: string | number
  payload: Payload
  keywordType?: 'seed' | 'longtail'
}

export async function pickRandomKeyword(options: PickKeywordOptions) {
  const { siteId, payload, keywordType = 'longtail' } = options

  // 先查找待使用的长尾词
  const { docs: longtailKeywords } = await payload.find({
    collection: 'generate-keywords',
    where: {
      site: { equals: siteId },
      status: { equals: 'pending' },
      keywordType: { equals: 'longtail' },
    },
    limit: 100,
  })

  if (longtailKeywords.length > 0) {
    const randomIndex = Math.floor(Math.random() * longtailKeywords.length)
    return longtailKeywords[randomIndex]
  }

  // 如果没有长尾词，用种子词
  const { docs: seedKeywords } = await payload.find({
    collection: 'generate-keywords',
    where: {
      site: { equals: siteId },
      status: { equals: 'pending' },
      keywordType: { equals: 'seed' },
    },
    limit: 100,
  })

  if (seedKeywords.length > 0) {
    const randomIndex = Math.floor(Math.random() * seedKeywords.length)
    return seedKeywords[randomIndex]
  }

  return null
}

export async function markKeywordUsed(
  keywordId: string | number,
  articleId: string | number,
  payload: Payload
) {
  await payload.update({
    collection: 'generate-keywords',
    id: keywordId,
    data: {
      status: 'used',
      usedAt: new Date().toISOString(),
      articleId: String(articleId),
    },
  })
}

export async function markKeywordReserved(
  keywordId: string | number,
  payload: Payload
) {
  await payload.update({
    collection: 'generate-keywords',
    id: keywordId,
    data: {
      status: 'reserved',
    },
  })
}

export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0
  if (str1 === str2) return 1

  const set1 = new Set(str1.split(''))
  const set2 = new Set(str2.split(''))

  let intersection = 0
  for (const char of set1) {
    if (set2.has(char)) intersection++
  }

  const union = set1.size + set2.size - intersection
  return union === 0 ? 0 : intersection / union
}

export async function checkKeywordSimilarity(
  keyword: string,
  siteId: string | number,
  payload: Payload,
  threshold = 0.6
): Promise<boolean> {
  const { docs: recentKeywords } = await payload.find({
    collection: 'generate-keywords',
    where: {
      site: { equals: siteId },
      status: { in: ['used', 'reserved'] },
      keyword: { not_equals: keyword },
    },
    sort: '-usedAt',
    limit: 50,
  })

  for (const kw of recentKeywords) {
    const similarity = calculateSimilarity(keyword, kw.keyword as string)
    if (similarity >= threshold) {
      return true
    }
  }

  return false
}
