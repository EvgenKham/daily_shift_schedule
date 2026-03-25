import { Alert, Button, Card, DatePicker, Empty, List, Modal, Space, Statistic, Tag, Upload, message } from 'antd'
import type { UploadProps } from 'antd'
import dayjs from 'dayjs'

import { parseScheduleXlsxFile } from '../features/schedule/parser'
import { deleteSchedule, getSchedule, putSchedule } from '../shared/db/dssIdb'
import type { ScheduleValidationIssue } from '../features/schedule/parser/types'
import type { RcFile } from 'antd/es/upload'
import { useEffect, useState } from 'react'
import type { ScheduleDoc } from '../shared/db/dssIdbTypes'

function formatMonthKey(monthKey: string) {
  return dayjs(`${monthKey}-01`).format('MMMM YYYY')
}

function showScheduleExistsWarning(monthKey: string) {
  Modal.warning({
    title: 'График на этот месяц уже загружен',
    content: `На ${formatMonthKey(monthKey)} уже есть сохраненный график. Для загрузки нового графика сначала удалите существующий или используйте кнопку "Обновить" в карточке загруженного графика.`,
    okText: 'Закрыть',
  })
}

function confirmDelete(monthKey: string) {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: 'Удаление графика',
      content: `Вы уверены, что хотите удалить график на ${formatMonthKey(monthKey)}? Это действие нельзя отменить.`,
      okText: 'OK',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
}

export function SchedulePage() {
  const [selectedMonthKey, setSelectedMonthKey] = useState(dayjs().format('YYYY-MM'))
  const [issues, setIssues] = useState<ScheduleValidationIssue[]>([])
  const [employeeCount, setEmployeeCount] = useState<number | null>(null)
  const [parsedShiftCount, setParsedShiftCount] = useState<number | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [existingSchedule, setExistingSchedule] = useState<ScheduleDoc | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(false)
  const [msgApi, msgContextHolder] = message.useMessage()

  useEffect(() => {
    let active = true
    void (async () => {
      setLoadingExisting(true)
      try {
        const saved = await getSchedule(selectedMonthKey)
        if (active) {
          setExistingSchedule(saved)
          // Load issues and stats from saved schedule
          if (saved) {
            // For backward compatibility, default to empty array if validationIssues is missing
            setIssues(saved.validationIssues ?? [])
            // Count employees and shifts from normalized data
            const normalized = saved.normalized as { employees?: Array<{ shiftsByDay?: Record<number, unknown> }> } | null
            const employeeCount = normalized?.employees?.length ?? 0
            setEmployeeCount(employeeCount > 0 ? employeeCount : null)
            
            // Count parsed shifts from normalized data
            let shiftCount = 0
            if (normalized?.employees) {
              for (const emp of normalized.employees) {
                if (emp.shiftsByDay) {
                  shiftCount += Object.keys(emp.shiftsByDay).length
                }
              }
            }
            setParsedShiftCount(shiftCount > 0 ? shiftCount : null)
          } else {
            setIssues([])
            setEmployeeCount(null)
            setParsedShiftCount(null)
          }
        }
      } finally {
        if (active) setLoadingExisting(false)
      }
    })()

    return () => {
      active = false
    }
  }, [selectedMonthKey])

  const parseAndSave = async (file: RcFile) => {
    const result = await parseScheduleXlsxFile(file)
    setIssues(result.issues)
    setEmployeeCount(result.stats.employeeCount)
    setParsedShiftCount(result.stats.parsedShiftCount)

    if (selectedMonthKey) {
      await putSchedule({
        scheduleMonthKey: selectedMonthKey,
        uploadedAt: Date.now(),
        sourceName: file.name,
        raw: result.raw,
        normalized: result.normalized,
        validationIssues: result.issues,
      })
      const saved = await getSchedule(selectedMonthKey)
      setExistingSchedule(saved)
    }
  }

  const uploadProps: UploadProps = {
    accept: '.xlsx,.xls',
    showUploadList: true,
    beforeUpload: async (file: RcFile) => {
      if (existingSchedule) {
        showScheduleExistsWarning(selectedMonthKey)
        return Upload.LIST_IGNORE
      }

      setIsParsing(true)
      setIssues([])
      setEmployeeCount(null)
      setParsedShiftCount(null)

      try {
        await parseAndSave(file)
        void msgApi.success('График загружен')
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Ошибка загрузки XLSX'
        setIssues([{ severity: 'error', code: 'UPLOAD_FAILED', message, raw: undefined }])
      } finally {
        setIsParsing(false)
      }

      // Prevent Upload from doing its own network transfer.
      return Upload.LIST_IGNORE
    },
  }

  const updateUploadProps: UploadProps = {
    accept: '.xlsx,.xls',
    showUploadList: false,
    beforeUpload: async (file: RcFile) => {
      setIsParsing(true)
      setIssues([])
      setEmployeeCount(null)
      setParsedShiftCount(null)

      try {
        await parseAndSave(file)
        void msgApi.success('График обновлен')
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Ошибка обновления XLSX'
        setIssues([{ severity: 'error', code: 'UPDATE_FAILED', message, raw: undefined }])
      } finally {
        setIsParsing(false)
      }

      return Upload.LIST_IGNORE
    },
  }

  return (
    <>
      {msgContextHolder}
      <Space orientation="vertical" size={16} style={{ display: 'flex' }}>
        <Card title="График (месяц)">
        <Space orientation="vertical" size={12} style={{ display: 'flex' }}>
          <Space wrap>
            <DatePicker
              picker="month"
              value={dayjs(`${selectedMonthKey}-01`)}
              onChange={(v) => {
                if (!v) return
                setSelectedMonthKey(v.format('YYYY-MM'))
              }}
            />
            <Upload {...uploadProps}>
              <Button>Загрузить XLSX</Button>
            </Upload>
            <Button disabled={isParsing}>Скачать шаблон</Button>
          </Space>

          <Alert
            type="info"
            showIcon
            message="Загрузите XLSX: парсер и валидация выполняются локально."
          />

          <Space wrap>
            <Statistic title="Сотрудников" value={employeeCount ?? '—'} />
            <Statistic title="Смен (нормализовано)" value={parsedShiftCount ?? '—'} />
          </Space>
        </Space>
        </Card>

        {existingSchedule ? (
          <Card
            title="Загруженный график"
            extra={<Tag color="blue">{formatMonthKey(existingSchedule.scheduleMonthKey)}</Tag>}
            loading={loadingExisting}
          >
            <Space wrap style={{ display: 'flex' }}>
              <span>{`Файл: ${existingSchedule.sourceName ?? 'без имени'} `}</span>
              <span>{`Загружен: ${dayjs(existingSchedule.uploadedAt).format('DD.MM.YYYY HH:mm')}`}</span>
            </Space>
            <Space wrap style={{ marginTop: 12 }}>
              <Button
                danger
                disabled={isParsing}
                onClick={() => {
                  void (async () => {
                    const confirmed = await confirmDelete(selectedMonthKey)
                    if (!confirmed) return
                    
                    await deleteSchedule(selectedMonthKey)
                    setExistingSchedule(null)
                    setIssues([])
                    setEmployeeCount(null)
                    setParsedShiftCount(null)
                    void msgApi.success('График удален')
                  })()
                }}
              >
                Удалить
              </Button>
              <Upload {...updateUploadProps}>
                <Button disabled={isParsing}>Обновить</Button>
              </Upload>
            </Space>
          </Card>
        ) : null}

        {existingSchedule ? (
          <Card
            title="Проблемы парсинга / валидации"
            extra={<Tag color="blue">{formatMonthKey(existingSchedule.scheduleMonthKey)}</Tag>}
          >
          {issues.length === 0 ? (
            <Empty description={isParsing ? 'Парсим XLSX...' : 'Нет проблем — график распознан.'} />
          ) : (
            <List
              size="small"
              bordered
              dataSource={issues}
              renderItem={(it) => (
                <List.Item style={{ alignItems: 'flex-start' }}>
                  <Space wrap align="start">
                    <Tag color={it.severity === 'error' ? 'red' : 'orange'}>{it.severity === 'error' ? 'Ошибка' : 'Предупреждение'}</Tag>
                    <span style={{ fontWeight: 600 }}>{it.code}</span>
                    <span>{it.message}</span>
                    {typeof it.dayNumber === 'number' ? <span>{`День: ${it.dayNumber}`}</span> : null}
                    {typeof it.rowIndex === 'number' ? <span>{`Строка: ${it.rowIndex + 1}`}</span> : null}
                    {typeof it.colIndex === 'number' ? <span>{`Колонка: ${it.colIndex + 1}`}</span> : null}
                  </Space>
                </List.Item>
              )}
            />
          )}
          </Card>
        ) : null}
      </Space>
    </>
  )
}

