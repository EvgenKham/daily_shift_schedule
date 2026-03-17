export function getGreeting(now = new Date()) {
  const h = now.getHours()
  if (h >= 6 && h <= 11) return 'Доброе утро'
  if (h >= 12 && h <= 17) return 'Добрый день'
  if (h >= 18 && h <= 23) return 'Добрый вечер'
  return 'Доброй ночи'
}

