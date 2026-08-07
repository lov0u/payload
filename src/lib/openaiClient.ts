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
      let rawContent = msg.content || ''
      
      // 调试日志
      console.log(`[OpenAI] 模型 ${modelConfig.name} 响应:`, JSON.stringify({
        content: msg.content?.substring(0, 200),
        reasoning_content: (msg as any).reasoning_content?.substring(0, 200),
        hasContent: !!msg.content,
        contentLength: msg.content?.length || 0,
      }, null, 2))
      
      if (!rawContent || rawContent.trim().length < 10) {
        rawContent = (msg as any).reasoning_content || ''
        const lines = rawContent.split('\n').filter((l: string) => l.trim())
        rawContent = lines.slice(-5).join('\n')
      }
      const cleanContent = rawContent
        .replace(/^[\s\n]+/, '')
        .replace(/<think>[\s\S]*?<\/think>\s*/g, '')
        .trim()
      
      console.log(`[OpenAI] 处理后内容长度: ${cleanContent.length}, 前100字符: ${cleanContent.substring(0, 100)}`)

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

      continue
    }
  }

  throw new Error(`所有模型调用失败，最后错误: ${lastError?.message || '未知错误'}`)
}

async function callOpenAIAPI(
  modelConfig: ModelConfig,
  messages: ChatMessage[],
  options: { temperature: number; maxTokens: number }
) {
  const { apiUrl, apiKey, model } = modelConfig
  const { temperature, maxTokens } = options

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
