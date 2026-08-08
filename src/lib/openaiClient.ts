import type { Payload } from 'payload'

export interface ModelConfig {
  id: string | number
  name: string
  apiUrl: string
  apiKey: string
  model: string
  order: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionResponse {
  content: string
  tokens: number
  modelId: string | number
  modelName: string
}

/**
 * 获取启用的模型列表（按order排序）
 */
export async function getEnabledModels(payload: Payload): Promise<ModelConfig[]> {
  const { docs } = await payload.find({
    collection: 'model-apis',
    where: {
      enabled: { equals: true },
    },
    sort: 'order',
    limit: 100,
  })

  return docs.map((doc: any) => ({
    id: doc.id,
    name: doc.name,
    apiUrl: doc.apiUrl,
    apiKey: doc.apiKey,
    model: doc.model,
    order: doc.order,
  }))
}

/**
 * 调用OpenAI兼容API（带故障切换）
 */
export async function chatCompletion(
  payload: Payload,
  messages: ChatMessage[],
  options: {
    temperature?: number
    maxTokens?: number
    purpose?: string
    siteId?: string | number
    articleId?: string | number
  } = {}
): Promise<ChatCompletionResponse> {
  const { temperature = 0.7, maxTokens = 4000, purpose = 'other', siteId, articleId } = options

  const models = await getEnabledModels(payload)

  if (models.length === 0) {
    throw new Error('没有可用的模型配置，请先在"模型API管理"中添加并启用模型')
  }

  let lastError: Error | null = null

  // 按顺序尝试每个模型
  for (const modelConfig of models) {
    const startTime = Date.now()

    try {
      const response = await callOpenAIAPI(modelConfig, messages, {
        temperature,
        maxTokens,
      })

      const duration = Date.now() - startTime
      const tokens = response.usage?.total_tokens || 0

      // 记录成功日志
      await payload.create({
        collection: 'model-usage-logs',
        data: {
          modelApi: modelConfig.id,
          status: 'success',
          tokens,
          duration,
          purpose,
          site: siteId,
          article: articleId,
        } as any,
      })

      // 更新模型统计
      await updateModelStats(payload, modelConfig.id, {
        success: true,
        tokens,
      })

      const msg = response.choices[0]?.message || {}
      // 推理模型（如 agnes-2.5-flash）把思考放在 reasoning_content，正式回复在 content
      // 当 content 为空时，从 reasoning_content 中提取最终结论
      let rawContent = msg.content || ''
      if (!rawContent || rawContent.trim().length < 10) {
        rawContent = msg.reasoning_content || ''
        // 从推理内容中提取结论（通常最后几行是结论）
        const lines = rawContent.split('\n').filter((l: string) => l.trim())
        rawContent = lines.slice(-5).join('\n')
      }
      // 清理推理模型特有的标记
      let cleanContent = rawContent
        .replace(/^[\s\n]+/, '')
        .replace(/ thinking[\s\S]*?<\/think>\s*/g, '')
        .trim()

      // 清洗AI可能输出的完整HTML页面（DOCTYPE、html、head、style、script等）
      cleanContent = cleanContent
        .replace(/```html\s*/gi, '')
        .replace(/```\s*/g, '')

      // 如果包含<body>标签，提取body内容
      const bodyMatch = cleanContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
      if (bodyMatch) {
        cleanContent = bodyMatch[1]
      } else {
        // 否则移除各种HTML页面标记
        cleanContent = cleanContent
          .replace(/<!DOCTYPE[^>]*>/gi, '')
          .replace(/<html[^>]*>/gi, '')
          .replace(/<\/html>/gi, '')
          .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<meta[^>]*>/gi, '')
          .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
      }

      cleanContent = cleanContent.trim()

      return {
        content: cleanContent,
        tokens,
        modelId: modelConfig.id,
        modelName: modelConfig.name,
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      lastError = error

      console.error(`[OpenAI] 模型 ${modelConfig.name} 调用失败:`, error.message)

      // 记录失败日志
      await payload.create({
        collection: 'model-usage-logs',
        data: {
          modelApi: modelConfig.id,
          status: 'failed',
          duration,
          errorMessage: error.message,
          purpose,
          site: siteId,
          article: articleId,
        } as any,
      })

      // 更新模型统计
      await updateModelStats(payload, modelConfig.id, {
        success: false,
      })

      // 继续尝试下一个模型
      continue
    }
  }

  // 所有模型都失败了
  throw new Error(`所有模型调用失败，最后错误: ${lastError?.message || '未知错误'}`)
}

/**
 * 调用单个OpenAI API
 */
async function callOpenAIAPI(
  modelConfig: ModelConfig,
  messages: ChatMessage[],
  options: { temperature: number; maxTokens: number }
) {
  const { apiUrl, apiKey, model } = modelConfig
  const { temperature, maxTokens } = options

  // 构建完整的API URL
  const url = apiUrl.endsWith('/chat/completions')
    ? apiUrl
    : `${apiUrl.replace(/\/$/, '')}/chat/completions`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API返回错误 (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  return data
}

/**
 * 更新模型统计信息
 */
async function updateModelStats(
  payload: Payload,
  modelId: string | number,
  stats: { success: boolean; tokens?: number }
) {
  const model = await payload.findByID({
    collection: 'model-apis',
    id: modelId,
  })

  const updates: any = {
    totalCalls: (model as any).totalCalls + 1,
    lastUsedAt: new Date().toISOString(),
  }

  if (stats.success) {
    updates.successCalls = (model as any).successCalls + 1
    if (stats.tokens) {
      updates.totalTokens = (model as any).totalTokens + stats.tokens
    }
  } else {
    updates.failedCalls = (model as any).failedCalls + 1
  }

  await payload.update({
    collection: 'model-apis',
    id: modelId,
    data: updates,
  })
}

/**
 * 获取模型使用统计
 */
export async function getModelStats(payload: Payload) {
  const { docs } = await payload.find({
    collection: 'model-apis',
    sort: 'order',
    limit: 100,
  })

  return docs.map((doc: any) => ({
    id: doc.id,
    name: doc.name,
    model: doc.model,
    order: doc.order,
    enabled: doc.enabled,
    totalCalls: doc.totalCalls || 0,
    successCalls: doc.successCalls || 0,
    failedCalls: doc.failedCalls || 0,
    successRate: doc.totalCalls > 0 ? ((doc.successCalls || 0) / doc.totalCalls) * 100 : 0,
    totalTokens: doc.totalTokens || 0,
    lastUsedAt: doc.lastUsedAt,
  }))
}
