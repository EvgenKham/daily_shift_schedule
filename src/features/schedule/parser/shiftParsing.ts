import type { ParsedShift, ShiftKind, TimeHM } from './types'

function formatTimeHM(t: TimeHM) {
  return `${t.hours}:${String(t.minutes).padStart(2, '0')}`
}

function parseTimeHM(raw: string): TimeHM | null {
  const s = raw.trim().replace(',', '.')
  // Examples: "7", "8", "7.30", "7:30"
  const m = s.match(/^(\d{1,2})(?:[.:](\d{1,2}))?$/)
  if (!m) return null

  const hours = Number(m[1])
  const minutes = m[2] == null ? 0 : Number(m[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null

  // We only expect 0 or 30 in the spec/examples.
  if (minutes !== 0 && minutes !== 30) return null
  if (hours < 0 || hours > 23) return null
  return { hours, minutes }
}

function classifyShiftKind(startHM: TimeHM, endHM: TimeHM, durationMinutes: number): ShiftKind {
  // Day/night are typical 12h. Everything >12h is treated as "24h-type".
  if (durationMinutes > 12 * 60) return '24h'
  if (durationMinutes < 12 * 60) return startHM.hours < endHM.hours ? 'day' : 'night'

  // durationMinutes === 12h
  return startHM.hours < endHM.hours ? 'day' : 'night'
}

export function parseShiftString(rawShift: string): ParsedShift | { error: string } {
  const raw = String(rawShift ?? '').trim()
  if (!raw) return { error: 'EMPTY_SHIFT' }

  // Normalize whitespace so that "7.30\\19.30" is reliably split.
  const s = raw.replace(/\s+/g, '')

  const hasBackslash = s.includes('\\')
  const hasSlash = s.includes('/')
  const sep = hasBackslash ? '\\' : hasSlash ? '/' : null
  if (!sep) return { error: 'UNKNOWN_SHIFT_SEPARATOR' }

  const parts = s.split(sep)
  if (parts.length !== 2) return { error: 'INVALID_SHIFT_SHAPE' }

  const startHM = parseTimeHM(parts[0])
  const endHM = parseTimeHM(parts[1])
  if (!startHM || !endHM) return { error: 'INVALID_TIME_PART' }

  const startMinutes = startHM.hours * 60 + startHM.minutes
  const endMinutes = endHM.hours * 60 + endHM.minutes

  // End can be "next day", so we wrap.
  let durationMinutes = endMinutes - startMinutes
  if (durationMinutes <= 0) durationMinutes += 24 * 60

  const kind = classifyShiftKind(startHM, endHM, durationMinutes)

  const start = formatTimeHM(startHM)
  const end = formatTimeHM(endHM)

  // Spec: "до ..." only for non-standard durations.
  // - for "классические" 24h shifts (start==end and duration==24h) we omit.
  // - for >12h but not classic 24h, and for <12h day/night we include.
  const isClassic24h = kind === '24h' && durationMinutes === 24 * 60 && startHM.hours === endHM.hours && startHM.minutes === endHM.minutes
  const appendUntilText =
    durationMinutes === 12 * 60
      ? undefined
      : isClassic24h
        ? undefined
        : `до ${end}`

  return {
    raw,
    startHM,
    endHM,
    start,
    end,
    kind,
    durationMinutes,
    appendUntilText,
  }
}

