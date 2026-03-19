import { openDB, type IDBPDatabase } from 'idb'

import {
  BINDINGS_STORE,
  DSS_DB_NAME,
  DSS_DB_VERSION,
  ROSTERS_STORE,
  SCHEDULES_STORE,
  SETTINGS_STORE,
  type DssDbSchema,
  type RosterDoc,
  type ScheduleDoc,
  type SettingsDoc,
  getRosterId,
} from './dssIdbTypes'

let dbPromise: Promise<IDBPDatabase<DssDbSchema>> | null = null

async function getDb() {
  if (dbPromise) return dbPromise

  dbPromise = openDB<DssDbSchema>(DSS_DB_NAME, DSS_DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains(SCHEDULES_STORE)) {
        const store = db.createObjectStore(SCHEDULES_STORE, { keyPath: 'scheduleMonthKey' })
        store.createIndex('byUploadedAt', 'uploadedAt')
      }

      if (!db.objectStoreNames.contains(ROSTERS_STORE)) {
        const store = db.createObjectStore(ROSTERS_STORE, { keyPath: 'rosterId' })
        store.createIndex('byDateKey', 'dateKey')
        store.createIndex('byScheduleMonthKey', 'scheduleMonthKey')
      }

      if (!db.objectStoreNames.contains(BINDINGS_STORE)) {
        db.createObjectStore(BINDINGS_STORE, { keyPath: 'bindingId' })
      }
    },
  })

  return dbPromise
}

export async function getSettings(): Promise<SettingsDoc | null> {
  const db = await getDb()
  const value = await db.get(SETTINGS_STORE, 'settings')
  return value ?? null
}

export async function putSettings(doc: SettingsDoc): Promise<void> {
  const db = await getDb()
  await db.put(SETTINGS_STORE, doc)
}

export function normalizeScheduleMonthKey(scheduleMonthKey: string) {
  // Keep it strict-ish: `YYYY-MM`.
  const s = String(scheduleMonthKey ?? '').trim()
  return /^\d{4}-\d{2}$/.test(s) ? s : ''
}

export async function getSchedule(scheduleMonthKey: string): Promise<ScheduleDoc | null> {
  const key = normalizeScheduleMonthKey(scheduleMonthKey)
  if (!key) return null
  const db = await getDb()
  const value = await db.get(SCHEDULES_STORE, key)
  return value ?? null
}

export async function putSchedule(doc: ScheduleDoc): Promise<void> {
  const key = normalizeScheduleMonthKey(doc.scheduleMonthKey)
  if (!key) throw new Error(`Invalid scheduleMonthKey: ${String(doc.scheduleMonthKey)}`)

  const db = await getDb()
  await db.put(SCHEDULES_STORE, { ...doc, scheduleMonthKey: key })
}

export async function deleteSchedule(scheduleMonthKey: string): Promise<void> {
  const key = normalizeScheduleMonthKey(scheduleMonthKey)
  if (!key) return
  const db = await getDb()
  await db.delete(SCHEDULES_STORE, key)
}

export async function getRoster(dateKey: string, scheduleMonthKey: string): Promise<RosterDoc | null> {
  const scheduleKey = normalizeScheduleMonthKey(scheduleMonthKey)
  if (!scheduleKey) return null

  const rosterId = getRosterId(String(dateKey), scheduleKey)
  const db = await getDb()
  const value = await db.get(ROSTERS_STORE, rosterId)
  return value ?? null
}

export async function putRoster(doc: RosterDoc): Promise<void> {
  const rosterId = getRosterId(doc.dateKey, doc.scheduleMonthKey)
  const db = await getDb()
  await db.put(ROSTERS_STORE, { ...doc, rosterId })
}

export async function deleteRoster(dateKey: string, scheduleMonthKey: string): Promise<void> {
  const scheduleKey = normalizeScheduleMonthKey(scheduleMonthKey)
  if (!scheduleKey) return

  const rosterId = getRosterId(String(dateKey), scheduleKey)
  const db = await getDb()
  await db.delete(ROSTERS_STORE, rosterId)
}

export async function clearAllForDev(): Promise<void> {
  const db = await getDb()

  // Note: Useful for debugging only.
  await Promise.all([db.clear(SETTINGS_STORE), db.clear(SCHEDULES_STORE), db.clear(ROSTERS_STORE), db.clear(BINDINGS_STORE)])
}

