# Backend TODO

Версия: 1.1  
Проект: Climate Controller  
Назначение: рабочий план разработки backend, чтобы по нему можно было ориентироваться при следующих задачах.

Основные спецификации:

- `docs/database-spec.md` - схема PostgreSQL-базы данных.
- `docs/logging-spec.md` - правила логирования, telemetry batch и device logs.
- `docs/arduino-api-spec.md` - REST API для контроллеров с будущей миграцией на MQTT.

Принятое backend-решение:

```txt
Backend: Express + tRPC
Database: PostgreSQL
ORM: Prisma
Frontend API: tRPC
Arduino API: REST endpoints
Deploy target: Docker Compose
```

## 1. Подготовка Структуры Backend

- [x] Разнести текущий `backend/src/trpc.ts` на отдельные модули.
- [x] Создать папку `routers`.
- [x] Создать папку `services`.
- [x] Создать папку `repositories`.
- [x] Создать папку `types`.
- [x] Создать папку `data` для временных mock/seed данных.

Ориентировочная структура:

```txt
backend/src/
  index.ts
  trpc.ts
  router.ts
  routers/
    dashboard.ts
    rooms.ts
    statistics.ts
    settings.ts
    events.ts
    logs.ts
  services/
    dashboardService.ts
    roomService.ts
    statisticsService.ts
    settingsService.ts
    deviceService.ts
    commandService.ts
    loggingService.ts
  repositories/
    roomRepository.ts
    deviceRepository.ts
    measurementRepository.ts
    settingsRepository.ts
    commandRepository.ts
    eventRepository.ts
    logRepository.ts
  types/
    climate.ts
  data/
    mockData.ts
```

## 2. Общие Типы И Контракты

- [x] Описать общие типы `Room`.
- [x] Описать `Algorithm`.
- [x] Описать `RoomStatus`.
- [x] Описать `ClimateMode`.
- [x] Описать `Device`.
- [x] Описать `Measurement`.
- [x] Описать `DeviceCommand`.
- [x] Описать `DeviceLog`.
- [x] Описать `Event`.
- [x] Вынести Zod-схемы input/output для tRPC и REST API.

## 3. PostgreSQL + Prisma

- [x] Установить Prisma и Prisma Client.
- [x] Настроить `.env` с `DATABASE_URL`.
- [x] Создать `prisma/schema.prisma`.
- [x] Перенести таблицы из `docs/database-spec.md` в Prisma schema.
- [x] Создать первую миграцию.
- [x] Добавить seed-данные.
- [x] Добавить npm/pnpm scripts для Prisma.

Примечание:

- `prisma generate` выполнен успешно.
- `prisma validate` выполнен успешно.
- PostgreSQL поднимается через `docker compose up -d postgres`.
- `prisma migrate dev` выполнен успешно.
- `prisma db seed` выполнен успешно.

Рекомендуемые scripts:

```json
{
  "db:generate": "prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:seed": "prisma db seed",
  "db:studio": "prisma studio"
}
```

## 4. Rooms API

- [x] Сделать `rooms.getAll`.
- [x] Сделать `rooms.getById`.
- [x] Сделать `rooms.updateSetpoint`.
- [x] Сделать `rooms.updateAlgorithm`.
- [x] Сделать `rooms.updatePidParams`.
- [x] Подключить mutations к RoomPage.

Важно:

- `updateSetpoint` обновляет `RoomSettings.current_setpoint`.
- `updateSetpoint` добавляет запись в `Setpoints`.
- `updateSetpoint` создаёт команду `SET_SETPOINT` в `DeviceCommands`.
- `updateSetpoint` создаёт событие `setpoint_changed`.

## 5. Dashboard API

- [ ] Сделать `dashboard.getSummary`.
- [ ] Получать комнаты из БД.
- [ ] Получать последние измерения по комнатам.
- [ ] Считать среднюю температуру.
- [ ] Считать помещения вне уставки.
- [ ] Считать активные алгоритмы.
- [ ] Отдавать последние важные события.

## 6. Statistics API

- [ ] Сделать `statistics.getAnalytics`.
- [ ] Добавить фильтры по комнатам.
- [ ] Добавить фильтр периода: `day`, `week`, `month`, `custom`.
- [ ] Добавить `dateFrom` и `dateTo` для custom period.
- [ ] Считать среднюю температуру.
- [ ] Считать среднюю ошибку регулирования.
- [ ] Считать максимальное отклонение.
- [ ] Считать энергопотребление.
- [ ] Считать распределение состояний.

## 7. Settings API

- [ ] Сделать `settings.get`.
- [ ] Сделать `settings.updateApplicationSettings`.
- [ ] Сделать `settings.updateSystemSettings`.
- [ ] Сделать `settings.applyAlgorithmToRooms`.
- [ ] Подключить mutations к SettingsPage.

Важно:

- Глобальные настройки хранить в `SystemSettings`.
- Пользовательские настройки хранить в `UserSettings`.
- Массовое применение алгоритма должно создавать команды для устройств выбранных комнат.

## 8. Controller REST API

- [ ] Сделать авторизацию устройства через `X-Device-Key`.
- [ ] Сделать `POST /api/devices/:deviceUid/telemetry`.
- [ ] Сделать `POST /api/devices/:deviceUid/telemetry/batch`.
- [ ] Сделать `POST /api/devices/:deviceUid/logs/batch`.
- [ ] Сделать `POST /api/devices/:deviceUid/heartbeat`.
- [ ] Сделать `POST /api/devices/:deviceUid/bootstrap`.
- [ ] Сделать `POST /api/devices/:deviceUid/state`.
- [ ] Сделать `GET /api/devices/:deviceUid/commands`.
- [ ] Сделать `POST /api/devices/:deviceUid/commands/:commandId/ack`.

Важно:

- Arduino не общается с БД напрямую.
- Arduino отправляет данные только на backend.
- Backend сохраняет telemetry в `Measurements`.
- Backend сохраняет технические логи в `DeviceLogs`.
- Backend отдаёт команды из `DeviceCommands`.
- Payload-ы REST API должны соответствовать `docs/arduino-api-spec.md`, чтобы потом перенести их в MQTT topics.

## 9. Logging

- [ ] Добавить таблицу `DeviceLogs` через Prisma.
- [ ] Добавить поля `device_sequence`, `device_uptime_ms`, `received_at` в `Measurements`.
- [ ] Реализовать защиту от дублей по `(device_id, device_sequence)`.
- [ ] Реализовать batch-приём telemetry.
- [ ] Реализовать batch-приём device logs.
- [ ] Создавать `Events` для важных device logs.
- [ ] Добавить `events.getRecent`.
- [ ] Добавить `logs.getDeviceLogs`.
- [ ] Добавить `logs.getRoomLogs`.

## 10. Commands Flow

- [ ] При изменении уставки создавать `DeviceCommands`.
- [ ] При изменении алгоритма создавать `DeviceCommands`.
- [ ] При изменении PID создавать `DeviceCommands`.
- [ ] При массовом применении алгоритма создавать команды для всех выбранных устройств.
- [ ] При выдаче команды Arduino менять статус `pending -> sent`.
- [ ] При ACK менять статус `sent -> acknowledged`.
- [ ] При ошибке менять статус `sent -> failed`.
- [ ] Добавить expiration команд.

## 11. Offline Detection

- [ ] Добавить настройку `telemetry_timeout_seconds`.
- [ ] Периодически проверять `Devices.last_seen_at`.
- [ ] Если устройство давно не присылало heartbeat/telemetry, ставить `is_online = false`.
- [ ] Создавать событие `device_offline`.
- [ ] При восстановлении связи создавать событие `device_online`.

## 12. Ошибки И Валидация

- [ ] Использовать Zod для всех tRPC input.
- [ ] Использовать Zod для всех Arduino REST body.
- [ ] Добавить `TRPCError` для frontend API.
- [ ] Добавить понятные HTTP-ошибки для Arduino API.
- [ ] Валидировать диапазон уставки.
- [ ] Валидировать PID-параметры.
- [ ] Валидировать algorithm code.
- [ ] Валидировать существование комнаты и устройства.

## 13. Seed/Test Data

- [ ] Создать seed пользователей.
- [ ] Создать seed администратора.
- [ ] Создать seed обычного пользователя.
- [ ] Создать seed комнат.
- [ ] Создать seed устройств.
- [ ] Создать seed алгоритмов.
- [ ] Создать seed текущих настроек комнат.
- [ ] Создать seed измерений за день/неделю.
- [ ] Создать seed событий.
- [ ] Создать seed системных настроек.

## 14. Frontend Integration

- [ ] Перевести DashboardPage на новые tRPC procedures.
- [ ] Перевести StatisticsPage на новые tRPC procedures.
- [x] Перевести RoomPage на реальные mutations.
- [ ] Перевести SettingsPage на реальные mutations.
- [ ] Добавить отображение online/offline статуса устройств.
- [ ] Добавить отображение `local`/`remote`/`failsafe` режима.
- [ ] Добавить пометку, что веб-панель не управляет устройством в `local`.
- [ ] Сохранять изменения веб-панели как desired config, если устройство в `local`.
- [ ] Добавить последние важные события на Dashboard.
- [ ] Добавить отдельную страницу Logs с фильтрами.
- [ ] Добавить страницу авторизации.
- [ ] Добавить управление пользователями в SettingsPage для администратора.

## 15. Авторизация

Нужно предусмотреть две роли: `admin` и `user`.

- [ ] Добавить users login.
- [ ] Добавить password hashing.
- [ ] Добавить session/JWT.
- [ ] Добавить роли `admin`, `user`.
- [ ] Добавить `users.getAll`.
- [ ] Добавить `users.create`.
- [ ] Добавить `users.updateRole`.
- [ ] Добавить `users.deactivate`.
- [ ] Добавить страницу добавления пользователей в SettingsPage.
- [ ] Ограничить опасные actions по роли.

Права:

- `admin` может добавлять пользователей, менять роли и управлять системными настройками.
- `user` может просматривать данные и менять доступные параметры управления без администрирования пользователей.

## 16. Frontend Polish

- [ ] Добавить страницу 404 для неизвестных маршрутов.
- [ ] Добавить страницу/состояние ошибки для критических frontend ошибок.
- [ ] Добавить аккуратные loading states вместо простого текста `Loading...`.
- [ ] Добавить skeleton loaders для Dashboard, Statistics, RoomPage и SettingsPage.
- [ ] Добавить empty states для случаев, когда нет комнат, измерений, логов или команд.
- [ ] Добавить error states для проблем backend/tRPC.
- [ ] Добавить визуальный online/offline статус устройств.
- [ ] Добавить небольшие анимации загрузки и переходов без перегруза интерфейса.
- [ ] Проверить адаптивность всех страниц на мобильной и десктопной ширине.
- [ ] Проверить, что длинный текст не ломает таблицы, карточки и кнопки.
- [ ] Добавить страницу Logs как отдельный раздел.

## 17. Frontend Refactoring

- [ ] Вынести повторяющиеся D3-графики в общие компоненты.
- [ ] Вынести общие UI-блоки: `Panel`, `MetricCard`, `StatusBadge`, `SegmentedControl`, `PageHeader`.
- [ ] Вынести общие функции форматирования температуры, времени, статусов.
- [ ] Вынести типы frontend API в отдельные файлы или использовать типы tRPC.
- [ ] Убрать дублирование CSS между Dashboard, Statistics, RoomPage и SettingsPage.
- [ ] Проверить структуру routes и навигации.
- [ ] Проверить, что frontend не содержит mock-данных после подключения backend.

## 18. Error Handling And Validation Review

- [ ] Проверить все frontend loading/error/empty states.
- [ ] Проверить поведение при выключенном backend.
- [ ] Проверить поведение при пустой базе.
- [ ] Проверить поведение при offline Arduino.
- [ ] Проверить поведение при неверном `deviceUid`.
- [ ] Проверить поведение при неверном `X-Device-Key`.
- [ ] Проверить поведение при повторной отправке telemetry batch.
- [ ] Проверить истечение срока действия команд.
- [ ] Проверить, что опасные команды не применяются в `failsafe`.

## 19. Tests

- [ ] Добавить unit tests для services.
- [ ] Добавить unit tests для расчёта statistics.
- [ ] Добавить unit tests для validation/Zod schemas.
- [ ] Добавить unit tests для command flow.
- [ ] Добавить unit tests для duplicate protection по `device_sequence`.
- [ ] Добавить integration tests для tRPC procedures.
- [ ] Добавить integration tests для Controller REST API.
- [ ] Добавить integration tests для Prisma repositories.
- [ ] Добавить smoke tests для основных frontend pages.
- [ ] Добавить тест seed-данных.

Возможные инструменты:

```txt
Vitest - unit/integration tests
Supertest - REST API tests
Playwright - frontend smoke/e2e tests
```

## 20. Production Readiness

- [ ] Настроить `.env.example`.
- [ ] Разделить env для development и production.
- [ ] Убедиться, что секреты не лежат в репозитории.
- [ ] Добавить backend healthcheck endpoint.
- [x] Добавить database healthcheck.
- [ ] Добавить graceful shutdown backend.
- [ ] Добавить CORS config через env.
- [ ] Добавить логирование backend-запросов.
- [ ] Добавить ограничение размера JSON body.
- [ ] Добавить rate limit для Controller REST API, если потребуется.
- [ ] Проверить production build frontend.
- [ ] Проверить production build backend.
- [x] Проверить Prisma migrations на чистой базе.

## 21. Deploy

- [ ] Использовать Docker Compose как основной способ деплоя.
- [x] Подготовить `docker-compose.yml`.
- [ ] Подготовить Dockerfile для backend.
- [ ] Подготовить Dockerfile или nginx-конфиг для frontend static build.
- [ ] Подготовить PostgreSQL для production.
- [ ] Подготовить production `.env`.
- [ ] Настроить запуск backend.
- [ ] Настроить frontend static build.
- [ ] Настроить reverse proxy, если используется VPS.
- [ ] Настроить HTTPS, если проект будет доступен извне.
- [ ] Применить Prisma migrations на production базе.
- [ ] Выполнить seed минимальных данных.
- [ ] Проверить frontend routes после деплоя.
- [ ] Проверить tRPC API после деплоя.
- [ ] Проверить Controller REST API после деплоя.
- [ ] Провести финальный smoke-check всего сценария.

Финальный сценарий проверки:

```txt
1. Открыть Dashboard.
2. Открыть Statistics.
3. Открыть RoomPage.
4. Изменить уставку.
5. Убедиться, что создана команда для устройства.
6. Отправить тестовую telemetry от Arduino/client script.
7. Убедиться, что графики и статус обновляются.
8. Проверить Settings.
9. Проверить последние Events/Logs.
```

## 22. Порядок Реализации

Рекомендуемый порядок:

1. Разнести backend по слоям.
2. Добавить Prisma + PostgreSQL.
3. Создать Prisma schema и миграции.
4. Добавить seed-данные.
5. Реализовать Rooms API.
6. Подключить RoomPage mutations.
7. Реализовать Settings API.
8. Реализовать Dashboard API.
9. Реализовать Statistics API с фильтрами.
10. Реализовать Controller REST API.
11. Реализовать logging и batch endpoints.
12. Реализовать commands flow.
13. Реализовать offline detection.
14. Добавить обработку ошибок и валидацию.
15. Добавить авторизацию и роли `admin`/`user`.
16. Доработать frontend polish: 404, loading, empty/error states.
17. Провести frontend refactoring.
18. Добавить страницу Logs.
19. Добавить unit tests.
20. Добавить integration tests.
21. Провести production readiness проверку.
22. Подготовить Docker Compose.
23. Выполнить deploy.
24. Провести финальный smoke-check.

## 23. Не Делать Сейчас

- [ ] Не подключать Arduino напрямую к базе данных.
- [ ] Не хранить пароль БД в прошивке Arduino.
- [ ] Не писать телеметрию часто в EEPROM.
- [ ] Не делать MQTT в первой версии, если REST API достаточно для курсовой.
- [ ] Не усложнять проект InfluxDB/TimescaleDB до появления реальной необходимости.
