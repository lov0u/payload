import type { Payload } from 'payload'

export interface PickKeywordOptions {
  siteId: string | number
  payload: Payload
  keywordType?: 'seed' | 'longtail'
}

export interface PickedKeyword {
  doc: any
  /** true = 关键词池已耗尽，本次是循环复用旧关键词 */
  recycled: boolean
}

/**
 * 选取关键词。
 * 策略：优先未用过的（pending，长尾优先于种子）；
 * 全部用完后进入「循环复用」模式，挑最久没用过的关键词再用一次。
 * 关键词可循环，标题由 AI 按关键词重新生成，因此不会重复。
 */
export async function pickRandomKeyword(options: PickKeywordOptions): Promise<PickedKeyword | null> {
  const { siteId, payload } = options

  // 1) 未使用的长尾词
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
    return { doc: longtailKeywords[randomIndex], recycled: false }
  }

  // 2) 未使用的种子词
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
    return { doc: seedKeywords[randomIndex], recycled: false }
  }

  // 3) 池子空了 → 循环复用：取最久未使用的一批，随机挑一个
  const { docs: recycledKeywords } = await payload.find({
    collection: 'generate-keywords',
    where: {
      site: { equals: siteId },
      status: { in: ['used', 'reserved'] },
    },
    sort: 'usedAt', // 最久未使用的排前面（null 也在前）
    limit: 20,
  })

  if (recycledKeywords.length > 0) {
    const randomIndex = Math.floor(Math.random() * recycledKeywords.length)
    return { doc: recycledKeywords[randomIndex], recycled: true }
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
