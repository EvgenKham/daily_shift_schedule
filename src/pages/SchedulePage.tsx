import { Alert, Button, Card, DatePicker, Empty, List, Space, Statistic, Tag, Upload } from 'antd'
import type { UploadProps } from 'antd'
import dayjs from 'dayjs'

import { parseScheduleXlsxFile } from '../features/schedule/parser'
import { putSchedule } from '../shared/db/dssIdb'
import type { ScheduleValidationIssue } from '../features/schedule/parser/types'
import type { RcFile } from 'antd/es/upload'
import { useState } from 'react'

export function SchedulePage() {
  const [selectedMonthKey, setSelectedMonthKey] = useState(dayjs().format('YYYY-MM'))
  const [issues, setIssues] = useState<ScheduleValidationIssue[]>([])
  const [employeeCount, setEmployeeCount] = useState<number | null>(null)
  const [parsedShiftCount, setParsedShiftCount] = useState<number | null>(null)
  const [isParsing, setIsParsing] = useState(false)

  const uploadProps: UploadProps = {
    accept: '.xlsx,.xls',
    showUploadList: true,
    beforeUpload: async (file: RcFile) => {
      setIsParsing(true)
      setIssues([])
      setEmployeeCount(null)
      setParsedShiftCount(null)

      try {
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
          })
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Ошибка загрузки XLSX'
        setIssues([{ severity: 'error', code: 'UPLOAD_FAILED', message, raw: undefined }])
      } finally {
        setIsParsing(false)
      }

      // Prevent Upload from doing its own network transfer.
      return false
    },
  }

  return (
    <Space orientation="vertical" size={16} style={{ display: 'flex' }}>
      <Card title="График (месяц)">
        <Space orientation="vertical" size={12} style={{ display: 'flex' }}>
          <Space wrap>
            <DatePicker
              picker="month"
              defaultValue={dayjs()}
              onChange={(v) => {
                if (!v) return
                setSelectedMonthKey(v.format('YYYY-MM'))
              }}
            />
            <Upload {...uploadProps}>
              <Button>Загрузить XLSX</Button>
            </Upload>
            <Button disabled={isParsing}>Скачать шаблон</Button>
            <Button danger disabled={isParsing}>
              Удалить график
            </Button>
            <Button disabled={isParsing}>Обновить</Button>
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

      <Card title="Проблемы парсинга / валидации">
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
    </Space>
  )
}

