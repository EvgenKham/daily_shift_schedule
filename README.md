# Daily shift schedule

React + TypeScript + Vite приложение для работы с месячным графиком и генерацией/редактированием наряда с офлайн‑хранением и экспортом в XLSX.

## Локальная разработка

Установка:

```bash
npm install
```

Запуск dev-сервера:

```bash
npm run dev
```

Сборка:

```bash
npm run build
```

Предпросмотр production-сборки:

```bash
npm run preview
```

## Деплой на Vercel (auto-deploy)

Проект готов к деплою как SPA (React Router). В репозитории добавлен `vercel.json`, который:

- задаёт **build**: `npm run build`
- задаёт **output**: `dist`
- включает **rewrites** на `index.html` для SPA‑маршрутизации

Шаги:

1. Запушьте репозиторий на GitHub.
2. В Vercel: **Add New → Project → Import Git Repository**.
3. Проверьте, что:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Нажмите **Deploy**.

Дальше Vercel будет автоматически:

- деплоить **Preview** на каждый PR/ветку
- деплоить **Production** при пуше в основную ветку (обычно `main`)
