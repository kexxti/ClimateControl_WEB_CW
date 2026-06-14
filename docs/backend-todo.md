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

- [x] Сделать `dashboard.getSummary`.
- [x] Получать комнаты из БД.
- [x] Получать последние измерения по комнатам.
- [x] Считать среднюю температуру.
- [x] Считать помещения вне уставки.
- [x] Считать активные алгоритмы.
- [x] Отдавать последние важные события.

## 6. Statistics API

- [x] Сделать `statistics.getAnalytics`.
- [x] Добавить фильтры по комнатам.
- [x] Добавить фильтр периода: `day`, `week`, `month`, `custom`.
- [x] Добавить `dateFrom` и `dateTo` для custom period.
- [x] Считать среднюю температуру.
- [x] Считать среднюю ошибку регулирования.
- [x] Считать максимальное отклонение.
- [x] Считать энергопотребление.
- [x] Считать распределение состояний.

## 7. Settings API

- [x] Сделать `settings.get`.
- [x] Сделать `settings.updateApplicationSettings`.
- [x] Сделать `settings.updateSystemSettings`.
- [x] Сделать `settings.applyAlgorithmToRooms`.
- [x] Подключить mutations к SettingsPage.

Важно:

- Глобальные настройки хранить в `SystemSettings`.
- Пользовательские настройки хранить в `UserSettings`.
- Массовое применение алгоритма должно создавать команды для устройств выбранных комнат.

## 8. Controller REST API

- [x] Сделать авторизацию устройства через `X-Device-Key`.
- [x] Сделать `POST /api/devices/:deviceUid/telemetry`.
- [x] Сделать `POST /api/devices/:deviceUid/telemetry/batch`.
- [x] Сделать `POST /api/devices/:deviceUid/logs/batch`.
- [x] Сделать `POST /api/devices/:deviceUid/heartbeat`.
- [x] Сделать `POST /api/devices/:deviceUid/bootstrap`.
- [x] Сделать `POST /api/devices/:deviceUid/state`.
- [x] Сделать `GET /api/devices/:deviceUid/commands`.
- [x] Сделать `POST /api/devices/:deviceUid/commands/:commandId/ack`.

Важно:

- Arduino не общается с БД напрямую.
- Arduino отправляет данные только на backend.
- Backend сохраняет telemetry в `Measurements`.
- Backend сохраняет технические логи в `DeviceLogs`.
- Backend отдаёт команды из `DeviceCommands`.
- Payload-ы REST API должны соответствовать `docs/arduino-api-spec.md`, чтобы потом перенести их в MQTT topics.

## 9. Logging

- [x] Добавить таблицу `DeviceLogs` через Prisma.
- [x] Добавить поля `device_sequence`, `device_uptime_ms`, `received_at` в `Measurements`.
- [x] Реализовать защиту от дублей по `(device_id, device_sequence)`.
- [x] Реализовать batch-приём telemetry.
- [x] Реализовать batch-приём device logs.
- [x] Создавать `Events` для важных device logs.
- [x] Добавить `events.getRecent`.
- [x] Добавить `logs.getDeviceLogs`.
- [x] Добавить `logs.getRoomLogs`.

## 10. Commands Flow

- [x] При изменении уставки создавать `DeviceCommands`.
- [x] При изменении алгоритма создавать `DeviceCommands`.
- [x] При изменении PID создавать `DeviceCommands`.
- [x] При массовом применении алгоритма создавать команды для всех выбранных устройств.
- [x] При выдаче команды Arduino менять статус `pending -> sent`.
- [x] При ACK менять статус `sent -> acknowledged`.
- [x] При ошибке менять статус `sent -> failed`.
- [x] Добавить expiration команд.

## 11. Offline Detection

- [x] Добавить настройку `telemetry_timeout_seconds`.
- [x] Периодически проверять `Devices.last_seen_at`.
- [x] Если устройство давно не присылало heartbeat/telemetry, ставить `is_online = false`.
- [x] Создавать событие `device_offline`.
- [x] При восстановлении связи создавать событие `device_online`.

## 12. Ошибки И Валидация

- [x] Использовать Zod для всех tRPC input.
- [x] Использовать Zod для всех Arduino REST body.
- [x] Добавить `TRPCError` для frontend API.
- [x] Добавить понятные HTTP-ошибки для Arduino API.
- [x] Валидировать диапазон уставки.
- [x] Валидировать PID-параметры.
- [x] Валидировать algorithm code.
- [x] Валидировать существование комнаты и устройства.

## 13. Seed/Test Data

- [x] Создать seed пользователей.
- [x] Создать seed администратора.
- [x] Создать seed обычного пользователя.
- [x] Создать seed комнат.
- [x] Создать seed устройств.
- [x] Создать seed алгоритмов.
- [x] Создать seed текущих настроек комнат.
- [x] Создать seed измерений за день/неделю.
- [x] Создать seed событий.
- [x] Создать seed системных настроек.

## 14. Frontend Integration

- [x] Перевести DashboardPage на новые tRPC procedures.
- [x] Перевести StatisticsPage на новые tRPC procedures.
- [x] Перевести RoomPage на реальные mutations.
- [x] Перевести SettingsPage на реальные mutations.
- [x] Добавить отображение online/offline статуса устройств.
- [x] Добавить отображение `local`/`remote`/`failsafe` режима.
- [x] Добавить пометку, что веб-панель не управляет устройством в `local`.
- [x] Сохранять изменения веб-панели как desired config, если устройство в `local`.
- [x] Добавить последние важные события на Dashboard.
- [x] Добавить отдельную страницу Logs с фильтрами.
- [x] Добавить страницу авторизации.
- [x] Добавить управление пользователями в SettingsPage для администратора.

## 15. Авторизация

Нужно предусмотреть две роли: `admin` и `user`.

- [x] Добавить users login.
- [x] Добавить password hashing.
- [x] Добавить session/JWT.
- [x] Добавить роли `admin`, `user`.
- [x] Добавить `users.getAll`.
- [x] Добавить `users.create`.
- [x] Добавить `users.updateRole`.
- [x] Добавить `users.deactivate`.
- [x] Добавить страницу добавления пользователей в SettingsPage.
- [x] Ограничить опасные actions по роли.

Права:

- `admin` может добавлять пользователей, менять роли и управлять системными настройками.
- `user` может просматривать данные и менять доступные параметры управления без администрирования пользователей.

## 15.1. Auth UX И Access Feedback

Цель: пользователь должен сразу понимать, вошёл он в систему или нет, какие действия ему доступны, и почему конкретное действие запрещено.

Обязательные требования:

- [x] Сделать protected routes для всех основных страниц панели: Dashboard, Statistics, Logs, Settings, RoomPage.
- [x] Если пользователь не авторизован и открывает любую страницу панели, показывать окно авторизации вместо содержимого панели.
- [x] После успешного входа возвращать пользователя на страницу, которую он пытался открыть.
- [x] Не показывать данные Dashboard, Statistics, Logs, Settings и RoomPage без авторизации.
- [x] Добавить глобальное состояние авторизации на frontend: текущий пользователь, роль, токен, статус проверки сессии.
- [x] При старте приложения проверять текущую сессию через `auth.me`.
- [x] Если токен отсутствует, истёк или backend вернул `UNAUTHORIZED`, очищать токен и показывать окно авторизации.
- [x] Добавить в левый нижний угол sidebar блок текущего пользователя: аватар-круг, логин, роль.
- [x] Добавить кнопку выхода из системы рядом с блоком пользователя или внутри user-menu.
- [x] После выхода очищать токен, сбрасывать tRPC cache и показывать окно авторизации.
- [x] Заменить текстовые ошибки сохранения на всплывающие уведомления/toasts.
- [x] Показывать toast при успешном действии: сохранение уставки, алгоритма, PID, настроек, создание пользователя.
- [x] Показывать toast при ошибке backend/tRPC: `UNAUTHORIZED`, `FORBIDDEN`, validation error, network error.
- [x] Для ограничений роли показывать понятную плашку: например, `Требуется роль admin`.
- [x] Дизейблить или скрывать опасные действия, если текущая роль не имеет прав.
- [x] Для disabled actions показывать пояснение рядом с контролом или через tooltip.
- [x] В SettingsPage явно показывать, какие блоки доступны только администратору.
- [x] В RoomPage показывать предупреждение, если действие будет сохранено как desired config из-за `local` или `offline` режима.
- [x] Сделать единый компонент уведомлений: `ToastProvider`, `useToast`, `ToastViewport`.
- [x] Сделать единый компонент защиты страниц: `ProtectedRoute` или `RequireAuth`.
- [x] Сделать единый компонент ограничения по роли: `RequireRole` или `AdminOnly`.

Дополнительные улучшения:

- [x] Добавить user-menu с пунктами: профиль, сменить пароль, выйти.
- [x] Добавить страницу или модальное окно смены пароля.
- [x] Добавить авто-logout при истечении токена.
- [x] Добавить refresh session или увеличить TTL токена через настройку env.
- [x] Показывать имя роли человекочитаемо: `Администратор`, `Пользователь`.
- [x] Добавить audit event для входа, выхода, создания пользователя и смены роли.
- [x] Добавить отдельный `Session expired` toast, чтобы пользователь понимал, почему его выкинуло на вход.
- [x] Добавить обработку недоступного backend: отдельная плашка `Backend недоступен`.
- [x] Добавить loading-состояние проверки сессии, чтобы страница не мигала между login и dashboard.
- [x] Проверить UX на мобильной ширине: sidebar user block должен оставаться видимым и не ломать меню.

## 15.2. Data Flow, Charts И Seed Data Quality

Цель: изменения параметров комнаты должны сразу и корректно отражаться в таблицах, карточках, графиках и статистике, а тестовые данные не должны создавать визуально ложную картину.

Проблемы, которые нужно исправить:

- После изменения уставки в кабинете 118 графики не показали новую уставку.
- В тестовых данных есть несколько температурных точек с одинаковым отображаемым временем, из-за этого график выглядит так, будто в один момент времени было несколько разных температур.

Проверка data-flow изменения уставки:

- [x] Проверить `rooms.updateSetpoint`: какие поля реально меняются в `RoomSettings`, `Setpoints`, `DeviceCommands`.
- [x] Проверить, что после изменения уставки backend возвращает актуальное состояние комнаты.
- [x] Проверить, что `RoomPage` инвалидирует все нужные tRPC queries после mutation.
- [x] Проверить, что `DashboardPage` инвалидируется или обновляется после изменения уставки.
- [x] Проверить, что `StatisticsPage` инвалидируется или обновляется после изменения уставки.
- [x] Проверить, что история для графика берёт актуальную уставку, а не только старое `Measurement.setpointValue`.
- [x] Решить правило отображения уставки на графике: текущая уставка из `RoomSettings` или историческая уставка из `Measurements`/`Setpoints`.
- [x] Если нужно отображать историю уставки, построить её из таблицы `Setpoints`, а не подставлять одно значение ко всем точкам.
- [x] Если нужна текущая уставка, обновлять последнюю точку графика сразу после mutation.
- [x] Добавить optimistic update или явный refetch после успешного изменения уставки.
- [x] Проверить сценарий `local/offline`: изменение сохраняется как `desiredSetpoint`, и UI должен честно показывать, что реальная уставка устройства ещё не изменилась.

Проверка графиков:

- [x] Проверить `RoomPage` temperature chart после изменения уставки.
- [x] Проверить `DashboardPage` selected room chart после изменения уставки.
- [x] Проверить `StatisticsPage` setpoint comparison chart после изменения уставки.
- [x] Проверить building average chart: средняя уставка должна пересчитываться из актуальных данных.
- [x] Добавить пустое/понятное состояние, если для комнаты нет истории измерений.
- [x] Проверить, что D3-график полностью перерисовывается при изменении props.

Исправление seed/test data:

- [x] Проверить генерацию измерений в `backend/prisma/seed.ts`.
- [x] Убедиться, что тестовые измерения для каждой комнаты имеют разные `created_at` и разные отображаемые подписи времени.
- [x] Не создавать несколько точек с одинаковым `time` label, если график группирует данные по подписи.
- [x] Сделать seed идемпотентным: повторный `db:seed` не должен бесконечно добавлять новые `DeviceLogs`, `Events` и измерения.
- [x] Разнести тестовые измерения по времени предсказуемо: например, каждые 30 или 60 минут.
- [x] Для каждой комнаты сгенерировать реалистичную температурную кривую за день/неделю.
- [x] Убедиться, что `device_sequence` уникален и не конфликтует при повторном seed.
- [x] После правки seed выполнить `pnpm --dir backend db:seed` и проверить графики на свежей базе.

Дополнительные улучшения:

- [x] Добавить backend helper для построения history points, чтобы RoomPage, Dashboard и Statistics не расходились в логике.
- [x] Добавить единый формат времени для графиков: дата+время для длинных периодов, время для дня.
- [x] Добавить агрегацию точек по времени, если несколько measurement попали в один visual bucket.
- [ ] Добавить tooltip на графиках с точным timestamp, температурой и уставкой.
- [ ] Добавить visual marker на графике в момент изменения уставки.
- [x] Добавить проверку, что после mutation данные в UI изменились без ручного refresh страницы.
- [ ] Добавить небольшой integration/smoke test для сценария: открыть RoomPage → изменить уставку → увидеть новую уставку в карточке и на графике.
- [ ] Добавить команду/скрипт очистки dev-данных, чтобы можно было пересоздать предсказуемый seed.

## 15.3. Device Emulator

Цель: иметь программный эмулятор контроллера, который работает как Arduino/ESP32 и позволяет тестировать backend, графики, команды и offline/online поведение без физического устройства.

Базовые требования:

- [ ] Добавить эмулятор устройства для уже существующей комнаты, например `Кабинет 118` или `Кабинет 203`.
- [ ] Эмулятор должен использовать существующую запись `Device` из seed, а не создавать новую комнату.
- [ ] Эмулятор должен общаться с backend только через Controller REST API, как реальный микроконтроллер.
- [ ] Использовать `deviceUid` и `X-Device-Key` из seed-данных.
- [ ] Добавить npm/pnpm script для запуска эмулятора, например `pnpm --dir backend device:emulator`.
- [ ] Сделать настройки эмулятора через env или CLI arguments: `deviceUid`, `deviceKey`, `backendUrl`, `intervalMs`, стартовая температура.

Поведение эмулятора:

- [ ] При старте отправлять `POST /api/devices/:deviceUid/bootstrap`.
- [ ] Каждые 30 секунд отправлять `POST /api/devices/:deviceUid/heartbeat`.
- [ ] Каждые 5 секунд отправлять `POST /api/devices/:deviceUid/telemetry`.
- [ ] Каждые 5 секунд запрашивать команды через `GET /api/devices/:deviceUid/commands`.
- [ ] После получения команды отправлять ACK через `POST /api/devices/:deviceUid/commands/:commandId/ack`.
- [ ] Поддержать команды `SET_SETPOINT`, `SET_ALGORITHM`, `SET_PID_PARAMS`, `SET_SAFETY_LIMITS`, `REQUEST_STATUS`.
- [ ] Эмулировать изменение температуры: если heater включен, температура плавно растет; если выключен, плавно приближается к окружающей.
- [ ] Эмулировать локальный режим: возможность переключить `remote -> local`, чтобы проверить desired config.
- [ ] Эмулировать возвращение `local -> remote`, чтобы проверить применение накопленной desired config.
- [ ] Эмулировать offline: остановить heartbeat/telemetry и проверить `device_offline`.
- [ ] Эмулировать восстановление online и проверить `device_online`.

Проверки через эмулятор:

- [ ] Изменить уставку на RoomPage и проверить, что эмулятор получил команду.
- [ ] Проверить, что после ACK команда стала `acknowledged`.
- [ ] Проверить, что telemetry появляется в `Measurements`.
- [ ] Проверить, что графики обновляются после новых telemetry данных.
- [ ] Проверить, что LogsPage показывает device logs от эмулятора.
- [ ] Проверить аварийный сценарий: температура выше critical limit создаёт событие `temperature_too_high` или `emergency_shutdown`.
- [ ] Проверить сценарий offline/online без физического Arduino.

Дополнительные улучшения:

- [ ] Сделать интерактивный режим эмулятора в консоли: команды `local`, `remote`, `offline`, `online`, `overheat`, `stop`.
- [ ] Добавить deterministic mode, чтобы telemetry была воспроизводимой для тестов.
- [ ] Добавить integration test, который запускает эмулятор на короткое время и проверяет записи в БД.
- [ ] Вынести payload builder-ы эмулятора в отдельный модуль, чтобы потом переиспользовать их в тестах Arduino REST API.

## 16. Frontend Polish

- [ ] Добавить страницу 404 для неизвестных маршрутов.
- [ ] Добавить возможность сворачивать боковую панель
- [ ] Протестировать состояние UI на узких экранах
- [ ] Добавить возможность сворачивать блоки (элементы интерфейса в настройках, статистике и т.д.)
- [ ] Добавить темную тему и внести необходимые изменения для ее поддержания на бэкэнд
- [ ] Добавить функциональность размера интерфейса
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
