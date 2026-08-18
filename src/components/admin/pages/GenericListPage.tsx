'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Card, Table, Button, Space, Popconfirm, message, Typography, Tag,
  Input, Select, Row, Col, Modal, Form, Spin,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  ReloadOutlined, ApiOutlined,
} from '@ant-design/icons'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'
import { getList, getOne, remove, update, create, getToken } from '@/lib/admin-api'

const { Title } = Typography

export interface ListColumn {
  title: string
  dataIndex: string
  key?: string
  width?: number
  render?: (value: unknown, record: Record<string, unknown>) => React.ReactNode
  sorter?: boolean
}

export interface FilterField {
  name: string
  label: string
  type: 'input' | 'select'
  placeholder?: string
  options?: { label: string; value: string | number }[]
}

export interface FormField {
  name: string
  label: string
  type: 'input' | 'textarea' | 'select' | 'number'
  required?: boolean
  placeholder?: string
  options?: { label: string; value: string | number }[]
  rules?: { required?: boolean; message?: string }[]
}

interface GenericListPageProps {
  collection: string
  title: string
  columns: ListColumn[]
  filterFields?: FilterField[]
  formFields?: FormField[]
  sortField?: string
  hideCreate?: boolean
  onRowClick?: (record: Record<string, unknown>) => void
  // 可选：在操作列追加「测试」按钮，调用指定 API 验证该条记录（如模型连通性）
  testButton?: { api: string; label?: string }
}

export default function GenericListPage(props: GenericListPageProps) {
  const { collection, title, columns, filterFields, formFields, sortField, hideCreate, onRowClick, testButton } = props

  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [sort, setSort] = useState<string>(sortField ? `-${sortField}` : '-createdAt')
  const [filters, setFilters] = useState<Record<string, string>>({})

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [form] = Form.useForm()

  // 测试按钮状态
  const [testingId, setTestingId] = useState<string | number | null>(null)
  const [testResultOpen, setTestResultOpen] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string }>({ ok: false, text: '' })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(pageSize),
        sort,
        depth: '0',
      }
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params[`where[${k}][contains]`] = v
      })
      const res = await getList(collection, params)
      setData(res.docs || [])
      setTotal(res.totalDocs || 0)
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [collection, page, pageSize, sort, filters])

  useEffect(() => { fetchData() }, [fetchData])

  const handleTableChange = (
    pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    sorter: SorterResult<Record<string, unknown>> | SorterResult<Record<string, unknown>>[],
  ) => {
    setPage(pagination.current || 1)
    setPageSize(pagination.pageSize || 20)
    if (!Array.isArray(sorter) && sorter.field) {
      const prefix = sorter.order === 'ascend' ? '' : '-'
      setSort(`${prefix}${String(sorter.field)}`)
    }
  }

  const handleDelete = async (id: string | number) => {
    try {
      await remove(collection, id)
      message.success('删除成功')
      fetchData()
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  const handleOpenCreate = () => {
    setEditingId(null)
    setModalTitle(`新建${title.replace('管理', '')}`)
    form.resetFields()
    setModalOpen(true)
  }

  const handleOpenEdit = async (record: Record<string, unknown>) => {
    setEditingId(String(record.id))
    setModalTitle(`编辑${title.replace('管理', '')}`)
    try {
      const res = await getOne(collection, record.id as string)
      const doc = res.doc || res
      const values: Record<string, unknown> = {}
      formFields?.forEach(f => { values[f.name] = doc[f.name] ?? undefined })
      form.setFieldsValue(values)
    } catch { /* use existing record data */ }
    setModalOpen(true)
  }

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()
      setModalLoading(true)
      if (editingId) {
        await update(collection, editingId, values)
        message.success('更新成功')
      } else {
        await create(collection, values)
        message.success('创建成功')
      }
      setModalOpen(false)
      fetchData()
    } catch (e: unknown) {
      if (e instanceof Error && e.message !== 'VALIDATE_FAILED') {
        message.error(e.message)
      }
    } finally {
      setModalLoading(false)
    }
  }

  const handleSearch = () => fetchData()
  const handleReset = () => { setFilters({}); setPage(1) }

  const handleTest = async (record: Record<string, unknown>) => {
    if (!testButton) return
    setTestingId(record.id as string)
    try {
      const res = await fetch(testButton.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `JWT ${getToken()}` } : {}) },
        body: JSON.stringify({ id: record.id }),
      })
      const data = await res.json().catch(() => ({}))
      const ok = data?.success === true
      const text = ok
        ? `✅ 连通成功\n模型：${data.model}\n耗时：${data.latencyMs}ms\n${data.usage ? `Token：${JSON.stringify(data.usage)}` : ''}\n返回示例：${data.sample || ''}`
        : `❌ 调用失败\n${data?.error || `HTTP ${res.status}`}`
      setTestResult({ ok, text })
      setTestResultOpen(true)
    } catch (e: unknown) {
      setTestResult({ ok: false, text: `❌ 请求异常：${e instanceof Error ? e.message : String(e)}` })
      setTestResultOpen(true)
    } finally {
      setTestingId(null)
    }
  }

  // Build table columns with actions
  const tableColumns: ColumnsType<Record<string, unknown>> = [
    ...columns.map(col => ({
      title: col.title,
      dataIndex: col.dataIndex,
      key: col.key || col.dataIndex,
      width: col.width,
      sorter: col.sorter,
      render: col.render,
    })),
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: Record<string, unknown>) => (
        <Space size={8}>
          {testButton && (
            <Button
              type="link"
              size="small"
              icon={<ApiOutlined />}
              style={{ color: '#52C41A', padding: 0 }}
              loading={testingId === record.id}
              onClick={() => handleTest(record)}
            >
              {testButton.label || '测试'}
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            style={{ color: '#1677FF', padding: 0 }}
            onClick={() => handleOpenEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除？"
            description="此操作不可恢复"
            onConfirm={() => handleDelete(record.id as string)}
            okText="确认"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              size="small"
              icon={<DeleteOutlined />}
              danger
              style={{ padding: 0 }}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* ====== 页面标题行 ====== */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 24,
      }}>
        <div>
          <Title level={4} style={{ margin: 0, fontSize: 20, fontWeight: 500, color: '#18191C' }}>
            {title}
          </Title>
        </div>
        {!hideCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            新建{title.replace('管理', '')}
          </Button>
        )}
      </div>

      {/* ====== 筛选卡片 ====== */}
      {filterFields && filterFields.length > 0 && (
        <Card style={{ marginBottom: 16, borderRadius: 8 }} styles={{ body: { padding: '16px 24px' } }}>
          <Row gutter={[16, 16]} align="middle">
            {filterFields.map(f => (
              <Col key={f.name}>
                {f.type === 'input' ? (
                  <Input
                    placeholder={f.placeholder || `搜索${f.label}`}
                    prefix={<SearchOutlined style={{ color: '#C9CDD4' }} />}
                    value={filters[f.name] || ''}
                    onChange={e => setFilters(prev => ({ ...prev, [f.name]: e.target.value }))}
                    allowClear
                    style={{ width: 200 }}
                    onPressEnter={handleSearch}
                  />
                ) : (
                  <Select
                    placeholder={f.placeholder || f.label}
                    value={filters[f.name] || undefined}
                    onChange={val => setFilters(prev => ({ ...prev, [f.name]: val || '' }))}
                    allowClear
                    style={{ width: 160 }}
                    options={f.options}
                  />
                )}
              </Col>
            ))}
            <Col>
              <Space>
                <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>查询</Button>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {/* ====== 工具栏 + 表格 ====== */}
      <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
        <div style={{
          padding: '12px 24px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', borderBottom: '1px solid #F0F0F0',
        }}>
          <span style={{ fontSize: 14, color: '#86909C' }}>
            共 {total} 条
          </span>
        </div>
        <Table
          columns={tableColumns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          onChange={handleTableChange}
          onRow={onRowClick ? record => ({
            style: { cursor: 'pointer' },
            onClick: () => onRowClick(record),
          }) : undefined}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t: number) => `共 ${t} 条`,
            style: { padding: '0 24px 16px' },
          }}
          style={{ padding: '0 24px' }}
        />
      </Card>

      {/* ====== 新建/编辑弹窗 ====== */}
      {formFields && (
        <Modal
          title={modalTitle}
          open={modalOpen}
          onOk={handleModalOk}
          onCancel={() => setModalOpen(false)}
          confirmLoading={modalLoading}
          destroyOnClose
          width={520}
          okText="确认"
          cancelText="取消"
        >
          <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
            {formFields.map(f => (
              <Form.Item
                key={f.name}
                name={f.name}
                label={f.label}
                rules={f.rules || (f.required ? [{ required: true, message: `请输入${f.label}` }] : [])}
              >
                {f.type === 'textarea' ? (
                  <Input.TextArea rows={4} placeholder={f.placeholder} />
                ) : f.type === 'select' ? (
                  <Select placeholder={f.placeholder} options={f.options} />
                ) : f.type === 'number' ? (
                  <Input type="number" placeholder={f.placeholder} />
                ) : (
                  <Input placeholder={f.placeholder} />
                )}
              </Form.Item>
            ))}
          </Form>
        </Modal>
      )}

      {/* ====== 测试结果弹窗 ====== */}
      <Modal
        title="连通性测试结果"
        open={testResultOpen}
        onOk={() => setTestResultOpen(false)}
        onCancel={() => setTestResultOpen(false)}
        okText="知道了"
        cancelButtonProps={{ style: { display: 'none' } }}
        width={520}
      >
        <pre style={{
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          fontFamily: 'inherit',
          fontSize: 14,
          lineHeight: 1.7,
          color: testResult.ok ? '#389E0D' : '#CF1322',
        }}>{testResult.text}</pre>
      </Modal>
    </div>
  )
}
