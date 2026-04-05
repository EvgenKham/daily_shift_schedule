import { Card, DatePicker, Space, Typography, Button, Alert, message } from 'antd'
import dayjs from 'dayjs'
import { useState, useEffect } from 'react'

import { generateRoster } from '../features/roster/generator'
import type { RosterData } from '../features/roster/types'
import { RosterBrigadesTable } from './RosterBrigadesTable'
import { RosterSupportTable } from './RosterSupportTable'
import { getSchedule } from '../shared/db/dssIdb'
import { loadJson } from '../shared/storage/localStorageJson'
import type { ScheduleNormalized } from '../features/schedule/parser/types'

const SETTINGS_STORAGE_KEY = 'dss_settings_v1'

export function RosterPage() {
  const [selectedDate, setSelectedDate] = useState(dayjs())
  const [rosterData, setRosterData] = useState<RosterData | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [msgApi, msgContextHolder] = message.useMessage()

  // Load saved roster when date changes
  useEffect(() => {
    const loadSavedRoster = async () => {
      // Try to load from IndexedDB
      // TODO: Implement getRoster call
      setRosterData(null)
    }

    void loadSavedRoster()
  }, [selectedDate])

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const dateKey = selectedDate.format('YYYY-MM-DD')
      const scheduleMonthKey = selectedDate.format('YYYY-MM')
      const dayNumber = selectedDate.date()

      // Load schedule for the month
      const scheduleDoc = await getSchedule(scheduleMonthKey)
      if (!scheduleDoc || !scheduleDoc.normalized) {
        void msgApi.error('График на этот месяц не загружен. Загрузите график на странице "График".')
        setRosterData(null)
        return
      }

      const schedule = scheduleDoc.normalized as ScheduleNormalized

      // Load settings from localStorage
      const settingsRaw = loadJson<unknown>(SETTINGS_STORAGE_KEY) as {
        substationNumber?: number | null
        chiefParamedicName?: string
        headOfSubstationName?: string
        brigades?: Array<{ number?: string; type?: string; startTime?: string }>
      } | null

      if (!settingsRaw?.brigades || settingsRaw.brigades.length === 0) {
        void msgApi.error('Настройки бригад не заданы. Настройте бригады на странице "Настройки".')
        setRosterData(null)
        return
      }

      // Generate roster
      const roster = generateRoster(schedule, {
        dayNumber,
        substationNumber: settingsRaw.substationNumber ?? null,
        brigades: settingsRaw.brigades.map((b) => ({
          number: String(b.number ?? ''),
          type: b.type as 'bit' | 'pediatric' | 'linear' | 'transport' ?? 'bit',
          startTime: b.startTime ?? '8:00',
        })),
        settings: {
          doctorName: settingsRaw.headOfSubstationName ?? '',
          doctorSignature: settingsRaw.headOfSubstationName ?? '',
          nurseName: settingsRaw.chiefParamedicName ?? '',
          nurseSignature: settingsRaw.chiefParamedicName ?? '',
        },
      })

      // Set the date key
      roster.dateKey = dateKey
      roster.scheduleMonthKey = scheduleMonthKey

      setRosterData(roster)

      if (roster.warnings.length > 0) {
        void msgApi.warning(`Сгенерировано с предупреждениями: ${roster.warnings.length}`)
      } else {
        void msgApi.success('Наряд сгенерирован')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка генерации наряда'
      void msgApi.error(errorMessage)
      setRosterData(null)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!rosterData) return
    // TODO: Save to IndexedDB
    void msgApi.info('Сохранение будет реализовано в следующей задаче')
  }

  const handleExport = async () => {
    if (!rosterData) return
    // TODO: Export to XLSX
    void msgApi.info('Экспорт будет реализован в следующей задаче')
  }

  return (
    <>
      {msgContextHolder}
      <Space orientation="vertical" size={16} style={{ display: 'flex' }}>
        <Card title="Наряд на смену">
          <Space orientation="vertical" size={12} style={{ display: 'flex' }}>
            <Space wrap>
              <DatePicker
                value={selectedDate}
                onChange={(v) => v && setSelectedDate(v)}
                format="DD.MM.YYYY"
              />
              <Button type="primary" onClick={handleGenerate} loading={isGenerating}>
                Сгенерировать
              </Button>
              <Button onClick={handleSave} disabled={!rosterData}>
                Сохранить
              </Button>
              <Button onClick={handleExport} disabled={!rosterData}>
                Скачать XLSX
              </Button>
            </Space>

            <Alert
              type="info"
              showIcon
              message="Выберите дату и нажмите «Сгенерировать» для создания наряда из графика и настроек"
            />
          </Space>
        </Card>

        {rosterData ? (
          <>
            <Card
              title={
                <Space>
                  <Typography.Text>Страница 1: Выездные бригады</Typography.Text>
                  <Typography.Text type="secondary">{selectedDate.format('DD.MM.YYYY')}</Typography.Text>
                </Space>
              }
            >
              <RosterBrigadesTable
                brigades={rosterData.brigades}
                onChange={(brigades) => {
                  setRosterData({ ...rosterData, brigades })
                }}
              />
            </Card>

            <Card
              title={
                <Space>
                  <Typography.Text>Страница 2: Вспомогательные службы</Typography.Text>
                  <Typography.Text type="secondary">{selectedDate.format('DD.MM.YYYY')}</Typography.Text>
                </Space>
              }
            >
              <RosterSupportTable
                supportServices={rosterData.supportServices}
                notes={rosterData.notes}
                doctorSignature={rosterData.doctorSignature}
                nurseSignature={rosterData.nurseSignature}
                onChange={(updates) => {
                  setRosterData({ ...rosterData, ...updates })
                }}
              />
            </Card>

            {rosterData.warnings.length > 0 && (
              <Card size="small" title="Предупреждения">
                <ul>
                  {rosterData.warnings.map((warning, idx) => (
                    <li key={idx}>
                      <Typography.Text type={warning.severity === 'error' ? 'danger' : 'warning'}>
                        [{warning.severity === 'error' ? 'Ошибка' : 'Предупреждение'}] {warning.message}
                      </Typography.Text>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <Alert
              type="warning"
              showIcon
              message="Наряд ещё не сгенерирован. Выберите дату и нажмите кнопку «Сгенерировать»"
            />
          </Card>
        )}
      </Space>
    </>
  )
}
