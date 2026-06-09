# Database Specification

Версия: 1.2  
Проект: Climate Controller  
Назначение: зафиксировать структуру базы данных для backend, frontend и будущего обмена с контроллером Renesas RA4M1 + ESP32-S3 Mini.

## 1. Общая Архитектура

Контроллер не должен подключаться к базе напрямую. База данных доступна только backend-у.

Основной поток данных:

```txt
RA4M1 + ESP32-S3 -> REST API backend -> Database
Frontend React   -> tRPC backend     -> Database
Backend          -> REST API/MQTT    -> RA4M1 + ESP32-S3
```

Роли компонентов:

- Frontend отображает данные, графики, настройки и отправляет пользовательские действия на backend.
- Backend проверяет данные, считает статистику, хранит состояние системы и создаёт команды для устройств.
- Database хранит комнаты, устройства, измерения, настройки, команды и события.
- ESP32-S3 выступает Wi-Fi модулем и отправляет HTTP-запросы на backend.
- В первой версии используется REST API; payload-ы проектируются совместимыми с будущим MQTT.

## 2. Основные Правила Проектирования

- Все даты и время хранятся в `timestamp with time zone`.
- Все внешние ключи должны иметь индексы.
- Для температуры, уставок, PID-параметров и мощности используются дробные типы: `numeric` или `double precision`.
- Контроллер не получает пароль от базы данных.
- Контроллер авторизуется через device API key.
- Исторические данные не перезаписываются. Новые измерения, уставки и команды добавляются отдельными строками.
- Текущее состояние хранится отдельно от истории, чтобы frontend быстро получал актуальные данные.
- Контроллер может временно буферизовать телеметрию и логи, но долговременное хранение выполняет backend/database.
- Для защиты от дублей при повторной отправке batch-запросов используются `device_sequence` и unique constraints.
- В первой версии принята модель `1 room = 1 device`.
- В первой версии физически используются только DS18B20 и нагреватель через MOSFET. Поля для влажности, CO2, охлаждения и вентиляции остаются nullable/future-compatible.
- Значение критической температуры по умолчанию: `35.0°C`, но оно должно быть изменяемым через настройки.

## 3. Enums

Эти значения можно реализовать как SQL enum, varchar с check constraint или enum в ORM.

### UserRole

```txt
admin
user
```

### AlgorithmCode

```txt
PID
ON_OFF
TIME
ML
```

### RoomStatus

```txt
heating
cooling
stable
offline
error
```

### ClimateMode

```txt
standard
energy_saving
night
manual
```

### ControlMode

```txt
local
remote
failsafe
```

### CommandType

```txt
SET_SETPOINT
SET_ALGORITHM
SET_PID_PARAMS
SET_MODE
REBOOT_DEVICE
REQUEST_STATUS
```

### CommandStatus

```txt
pending
sent
acknowledged
failed
expired
```

### SettingScope

```txt
system
user
room
```

### EventSeverity

```txt
info
warning
error
critical
```

### LogLevel

```txt
debug
info
warning
error
critical
```

## 4. Tables

## 4.1 Users

Пользователи системы.

| Column | Type | Required | Notes |
|---|---:|---:|---|
| id | bigint | yes | primary key |
| login | varchar | yes | unique |
| password_hash | varchar | yes | hash пароля |
| role | varchar | yes | `admin`, `user` |
| is_active | boolean | yes | default `true` |
| created_at | timestamptz | yes | дата создания |
| updated_at | timestamptz | yes | дата обновления |
| last_login_at | timestamptz | no | последний вход |

Индексы:

- unique index on `login`
- index on `role`

Роли:

- `admin` - может управлять системой и добавлять пользователей.
- `user` - может просматривать данные и управлять доступными настройками без администрирования пользователей.

## 4.2 UserSettings

Пользовательские настройки интерфейса.

| Column | Type | Required | Notes |
|---|---:|---:|---|
| id | bigint | yes | primary key |
| user_id | bigint | yes | FK -> Users.id |
| key | varchar | yes | название настройки |
| value | jsonb | yes | значение настройки |
| created_at | timestamptz | yes | дата создания |
| updated_at | timestamptz | yes | дата обновления |

Примеры `key`:

```txt
theme
dashboard_layout
preferred_period
```

Ограничения:

- unique `(user_id, key)`

## 4.3 SystemSettings

Глобальные настройки приложения.

| Column | Type | Required | Notes |
|---|---:|---:|---|
| id | bigint | yes | primary key |
| key | varchar | yes | unique |
| value | jsonb | yes | значение настройки |
| created_at | timestamptz | yes | дата создания |
| updated_at | timestamptz | yes | дата обновления |

Примеры `key`:

```txt
refresh_interval
default_algorithm
default_mode
telemetry_timeout_seconds
critical_temperature
telemetry_interval_ms
heartbeat_interval_ms
command_poll_interval_ms
```

## 4.4 Rooms

Логические помещения: аудитории, кабинеты, лаборатории.

| Column | Type | Required | Notes |
|---|---:|---:|---|
| id | bigint | yes | primary key |
| name | varchar | yes | например `Кабинет 203` |
| location | varchar | no | корпус, этаж или описание |
| floor | integer | no | этаж |
| is_active | boolean | yes | default `true` |
| created_at | timestamptz | yes | дата создания |
| updated_at | timestamptz | yes | дата обновления |

Индексы:

- index on `name`
- index on `floor`

## 4.5 Devices

Физические устройства, например связка Renesas RA4M1 + ESP32-S3 Mini.

В первой версии используется модель `1 room = 1 device`. Если проект расширится, ограничение unique по `room_id` можно снять.

| Column | Type | Required | Notes |
|---|---:|---:|---|
| id | bigint | yes | primary key |
| room_id | bigint | yes | FK -> Rooms.id |
| device_uid | varchar | yes | внешний id устройства, unique |
| name | varchar | yes | человекочитаемое имя |
| api_key_hash | varchar | yes | hash ключа устройства |
| firmware_version | varchar | no | версия прошивки |
| ip_address | varchar | no | последний известный IP |
| last_seen_at | timestamptz | no | последний heartbeat/telemetry |
| is_online | boolean | yes | default `false` |
| is_active | boolean | yes | default `true` |
| created_at | timestamptz | yes | дата создания |
| updated_at | timestamptz | yes | дата обновления |

Индексы:

- unique index on `device_uid`
- unique index on `room_id`
- index on `last_seen_at`

## 4.6 RegulationAlgorithms

Справочник алгоритмов регулирования.

| Column | Type | Required | Notes |
|---|---:|---:|---|
| id | bigint | yes | primary key |
| code | varchar | yes | unique: `PID`, `ON_OFF`, `TIME`, `ML` |
| name | varchar | yes | название для интерфейса |
| description | varchar | no | описание |
| is_enabled | boolean | yes | default `true` |
| created_at | timestamptz | yes | дата создания |
| updated_at | timestamptz | yes | дата обновления |

## 4.7 RoomSettings

Текущие настройки комнаты.

Эта таблица нужна для быстрого получения актуального состояния. История уставок и алгоритмов хранится отдельно.

| Column | Type | Required | Notes |
|---|---:|---:|---|
| id | bigint | yes | primary key |
| room_id | bigint | yes | FK -> Rooms.id, unique |
| current_setpoint | numeric | yes | текущая уставка |
| desired_setpoint | numeric | no | желаемая уставка из веб-панели, может ждать remote-режима |
| algorithm_id | bigint | yes | FK -> RegulationAlgorithms.id |
| desired_algorithm_id | bigint | no | желаемый алгоритм из веб-панели |
| mode | varchar | yes | `standard`, `energy_saving`, `night`, `manual` |
| control_mode | varchar | yes | `local`, `remote`, `failsafe` |
| status | varchar | yes | `heating`, `cooling`, `stable`, `offline`, `error` |
| critical_temperature | numeric | yes | default `35.0` |
| updated_by_user_id | bigint | no | FK -> Users.id |
| created_at | timestamptz | yes | дата создания |
| updated_at | timestamptz | yes | дата обновления |

Ограничения:

- unique `room_id`

Поведение `desired_*`:

- если контроллер в `remote`, backend может создать команду и применить desired config;
- если контроллер в `local`, frontend сохраняет изменения как desired config, но backend не должен принудительно применять их;
- когда контроллер сам возвращается в `remote`, backend создаёт команды для применения накопленной desired config.

## 4.8 RoomAlgorithmParameters

Параметры алгоритма для конкретной комнаты.

Например, для PID это `kp`, `ki`, `kd`, `hysteresis`.

| Column | Type | Required | Notes |
|---|---:|---:|---|
| id | bigint | yes | primary key |
| room_id | bigint | yes | FK -> Rooms.id |
| algorithm_id | bigint | yes | FK -> RegulationAlgorithms.id |
| kp | numeric | no | PID proportional |
| ki | numeric | no | PID integral |
| kd | numeric | no | PID derivative |
| hysteresis | numeric | no | гистерезис |
| is_active | boolean | yes | активный набор параметров |
| created_by_user_id | bigint | no | FK -> Users.id |
| created_at | timestamptz | yes | дата создания |
| updated_at | timestamptz | yes | дата обновления |

Индексы:

- index on `room_id`
- index on `algorithm_id`
- partial unique index on `(room_id, algorithm_id)` where `is_active = true`

## 4.9 Measurements

История телеметрии от устройств.

Каждая строка - одно измерение, пришедшее от Arduino или другого устройства.

| Column | Type | Required | Notes |
|---|---:|---:|---|
| id | bigint | yes | primary key |
| room_id | bigint | yes | FK -> Rooms.id |
| device_id | bigint | yes | FK -> Devices.id |
| temperature | numeric | yes | температура в комнате |
| humidity | numeric | no | future поле, в первой версии не используется |
| outside_temperature | numeric | no | внешняя температура |
| power | numeric | no | потребляемая мощность |
| setpoint_value | numeric | no | уставка на момент измерения |
| heater_state | boolean | no | нагреватель включён |
| cooler_state | boolean | no | future поле, в первой версии не используется |
| algorithm_id | bigint | no | FK -> RegulationAlgorithms.id |
| device_sequence | bigint | no | sequence записи на устройстве |
| device_uptime_ms | bigint | no | uptime устройства в миллисекундах |
| raw_payload | jsonb | no | исходные данные от устройства |
| created_at | timestamptz | yes | время измерения |
| received_at | timestamptz | yes | когда backend получил запись |

Индексы:

- index on `(room_id, created_at)`
- index on `(device_id, created_at)`
- index on `(device_id, received_at)`
- unique index on `(device_id, device_sequence)` where `device_sequence is not null`
- index on `created_at`

Важно:

- Для графиков Dashboard, Statistics и RoomPage данные берутся из этой таблицы.
- В первой версии обязательным измерением является только температура DS18B20.
- `created_at` должен приходить с backend-временем, если Arduino не имеет точных часов.
- `received_at` всегда выставляется backend-ом.
- `device_sequence` нужен, чтобы не создавать дубли при повторной отправке batch.

## 4.10 Setpoints

История изменения уставок.

| Column | Type | Required | Notes |
|---|---:|---:|---|
| id | bigint | yes | primary key |
| room_id | bigint | yes | FK -> Rooms.id |
| value | numeric | yes | значение уставки |
| source | varchar | yes | `manual`, `schedule`, `algorithm`, `system` |
| created_by_user_id | bigint | no | FK -> Users.id |
| created_at | timestamptz | yes | время изменения |

Индексы:

- index on `(room_id, created_at)`
- index on `created_by_user_id`

Важно:

- `RoomSettings.current_setpoint` хранит текущее значение.
- `Setpoints` хранит историю изменений.

## 4.11 DeviceCommands

Очередь команд для контроллера.

Команды создаёт backend, а ESP32-S3 забирает их через REST API. В будущем транспорт можно заменить на MQTT без изменения payload-ов.

| Column | Type | Required | Notes |
|---|---:|---:|---|
| id | bigint | yes | primary key |
| device_id | bigint | yes | FK -> Devices.id |
| room_id | bigint | yes | FK -> Rooms.id |
| type | varchar | yes | CommandType |
| payload | jsonb | yes | параметры команды |
| status | varchar | yes | CommandStatus |
| created_by_user_id | bigint | no | FK -> Users.id |
| created_at | timestamptz | yes | команда создана |
| sent_at | timestamptz | no | команда отдана устройству |
| acknowledged_at | timestamptz | no | устройство подтвердило |
| failed_at | timestamptz | no | команда провалена |
| expires_at | timestamptz | no | срок действия команды |
| error_message | varchar | no | причина ошибки |

Индексы:

- index on `(device_id, status, created_at)`
- index on `(room_id, created_at)`
- index on `created_by_user_id`

Пример `payload` для `SET_SETPOINT`:

```json
{
  "setpoint": 23.0
}
```

Пример `payload` для `SET_PID_PARAMS`:

```json
{
  "kp": 1.2,
  "ki": 0.35,
  "kd": 0.08,
  "hysteresis": 0.4
}
```

## 4.12 Events

Журнал событий системы.

Используется для диагностики, уведомлений и истории важных действий.

| Column | Type | Required | Notes |
|---|---:|---:|---|
| id | bigint | yes | primary key |
| room_id | bigint | no | FK -> Rooms.id |
| device_id | bigint | no | FK -> Devices.id |
| user_id | bigint | no | FK -> Users.id |
| type | varchar | yes | тип события |
| severity | varchar | yes | EventSeverity |
| message | varchar | yes | человекочитаемое сообщение |
| payload | jsonb | no | дополнительные данные |
| created_at | timestamptz | yes | дата события |

Примеры `type`:

```txt
device_online
device_offline
telemetry_received
temperature_too_high
temperature_too_low
setpoint_changed
algorithm_changed
command_created
command_acknowledged
command_failed
```

Индексы:

- index on `(room_id, created_at)`
- index on `(device_id, created_at)`
- index on `(severity, created_at)`

## 4.13 DeviceLogs

Сырые технические логи от Arduino или другого устройства.

Эта таблица отличается от `Events`: `DeviceLogs` хранит низкоуровневые сообщения устройства, а `Events` хранит нормализованные события системы для интерфейса и аналитики.

| Column | Type | Required | Notes |
|---|---:|---:|---|
| id | bigint | yes | primary key |
| device_id | bigint | yes | FK -> Devices.id |
| room_id | bigint | no | FK -> Rooms.id, можно заполнить из Devices.room_id |
| level | varchar | yes | LogLevel |
| type | varchar | yes | тип лога, например `wifi_connected` |
| message | varchar | yes | короткое сообщение |
| payload | jsonb | no | дополнительные данные |
| device_sequence | bigint | no | sequence записи на устройстве |
| device_uptime_ms | bigint | no | uptime устройства в миллисекундах |
| created_at | timestamptz | yes | время события, если известно |
| received_at | timestamptz | yes | когда backend получил запись |

Примеры `type`:

```txt
boot
wifi_connected
wifi_disconnected
sensor_read_failed
command_applied
command_failed
low_memory
buffer_overflow
```

Индексы:

- index on `(device_id, received_at)`
- index on `(room_id, received_at)`
- index on `(level, received_at)`
- index on `(type, received_at)`
- unique index on `(device_id, device_sequence)` where `device_sequence is not null`

Важно:

- `DeviceLogs` можно показывать на будущей странице Logs.
- Для важных логов backend может создавать соответствующие записи в `Events`.
- `debug`/`info` логи можно удалять раньше, чем `warning`/`error`/`critical`.

## 5. Relationships

```txt
Users 1 -> N UserSettings
Users 1 -> N Setpoints
Users 1 -> N DeviceCommands
Users 1 -> N Events

Rooms 1 -> 1 Devices
Rooms 1 -> N Measurements
Rooms 1 -> N Setpoints
Rooms 1 -> 1 RoomSettings
Rooms 1 -> N RoomAlgorithmParameters
Rooms 1 -> N DeviceCommands
Rooms 1 -> N Events
Rooms 1 -> N DeviceLogs

Devices 1 -> N Measurements
Devices 1 -> N DeviceCommands
Devices 1 -> N Events
Devices 1 -> N DeviceLogs

RegulationAlgorithms 1 -> N RoomSettings
RegulationAlgorithms 1 -> N RoomAlgorithmParameters
RegulationAlgorithms 1 -> N Measurements
```

## 6. Controller Communication Contract

Контроллер общается только с backend. ESP32-S3 отвечает за Wi-Fi/HTTP-обмен.

### 6.1 Send Telemetry

```txt
POST /api/devices/:deviceUid/telemetry
```

Headers:

```txt
X-Device-Key: <device-api-key>
```

Body:

```json
{
  "deviceSequence": 101,
  "deviceUptimeMs": 120000,
  "temperature": 22.8,
  "humidity": 41.0,
  "outsideTemperature": 12.4,
  "power": 0.8,
  "setpointValue": 23.0,
  "heaterState": true,
  "coolerState": false
}
```

Backend actions:

- проверяет `deviceUid` и `X-Device-Key`;
- находит `Devices`;
- создаёт запись в `Measurements`;
- обновляет `Devices.last_seen_at`;
- обновляет `Devices.is_online`;
- при необходимости обновляет `RoomSettings.status`;
- создаёт событие `telemetry_received`.
- заполняет `Measurements.received_at`;
- игнорирует дубль, если `(device_id, device_sequence)` уже существует.

### 6.1.1 Send Telemetry Batch

```txt
POST /api/devices/:deviceUid/telemetry/batch
```

Headers:

```txt
X-Device-Key: <device-api-key>
```

Body:

```json
{
  "readings": [
    {
      "deviceSequence": 101,
      "deviceUptimeMs": 120000,
      "temperature": 22.7,
      "setpointValue": 23.0,
      "heaterState": true
    },
    {
      "deviceSequence": 102,
      "deviceUptimeMs": 125000,
      "temperature": 22.8,
      "setpointValue": 23.0,
      "heaterState": true
    }
  ]
}
```

Backend response:

```json
{
  "accepted": 2,
  "duplicates": 0,
  "failed": 0
}
```

Backend actions:

- валидирует каждую запись;
- сохраняет новые записи в `Measurements`;
- пропускает дубли по `(device_id, device_sequence)`;
- обновляет `Devices.last_seen_at`;
- создаёт `Events` только для важных состояний.

### 6.2 Heartbeat

```txt
POST /api/devices/:deviceUid/heartbeat
```

Body:

```json
{
  "deviceUptimeMs": 180000,
  "freeMemory": 512,
  "wifiRssi": -61
}
```

Backend actions:

- обновляет `last_seen_at`;
- выставляет `is_online = true`;
- при переходе offline -> online создаёт событие `device_online`.

### 6.2.1 Send Device Logs Batch

```txt
POST /api/devices/:deviceUid/logs/batch
```

Headers:

```txt
X-Device-Key: <device-api-key>
```

Body:

```json
{
  "logs": [
    {
      "deviceSequence": 55,
      "deviceUptimeMs": 95000,
      "level": "info",
      "type": "wifi_connected",
      "message": "WiFi connected",
      "payload": {
        "rssi": -62
      }
    }
  ]
}
```

Backend response:

```json
{
  "accepted": 1,
  "duplicates": 0,
  "failed": 0
}
```

Backend actions:

- сохраняет новые записи в `DeviceLogs`;
- пропускает дубли по `(device_id, device_sequence)`;
- для `warning`, `error`, `critical` при необходимости создаёт `Events`;
- обновляет `Devices.last_seen_at`.

### 6.3 Get Commands

```txt
GET /api/devices/:deviceUid/commands
```

Backend returns:

```json
{
  "commands": [
    {
      "id": 123,
      "type": "SET_SETPOINT",
      "payload": {
        "setpoint": 23.0
      }
    }
  ]
}
```

Backend actions:

- выбирает команды со статусом `pending`;
- выставляет `status = sent`;
- выставляет `sent_at = now()`.

### 6.4 Acknowledge Command

```txt
POST /api/devices/:deviceUid/commands/:commandId/ack
```

Body:

```json
{
  "success": true,
  "message": "applied"
}
```

Backend actions:

- если `success = true`, выставляет `status = acknowledged`;
- если `success = false`, выставляет `status = failed`;
- заполняет `acknowledged_at` или `failed_at`;
- создаёт событие `command_acknowledged` или `command_failed`.

## 7. Frontend/tRPC Contract

Frontend работает через tRPC.

Минимальные процедуры:

```txt
dashboard.getSummary
statistics.getAnalytics
rooms.getAll
rooms.getById
rooms.updateSetpoint
rooms.updateAlgorithm
rooms.updatePidParams
settings.get
settings.updateApplicationSettings
settings.updateSystemSettings
settings.applyAlgorithmToRooms
events.getRecent
logs.getDeviceLogs
logs.getRoomLogs
users.getAll
users.create
users.updateRole
users.deactivate
```

### rooms.updateSetpoint

Input:

```json
{
  "roomId": 203,
  "value": 23.0
}
```

Backend actions:

- валидирует уставку;
- если `control_mode = remote`, обновляет `RoomSettings.current_setpoint` и создаёт команду;
- если `control_mode = local`, обновляет `RoomSettings.desired_setpoint` без принудительного применения;
- создаёт запись в `Setpoints`;
- создаёт команду `SET_SETPOINT` в `DeviceCommands`, когда её можно применить;
- создаёт событие `setpoint_changed`.

### rooms.updateAlgorithm

Input:

```json
{
  "roomId": 203,
  "algorithmCode": "PID"
}
```

Backend actions:

- если `control_mode = remote`, обновляет `RoomSettings.algorithm_id` и создаёт команду;
- если `control_mode = local`, обновляет `RoomSettings.desired_algorithm_id`;
- создаёт событие `algorithm_changed`.

## 8. Dashboard Data Mapping

Dashboard использует:

- `Rooms`
- `RoomSettings`
- последние `Measurements`
- агрегаты по `Measurements`
- последние события из `Events`
- последние важные `DeviceLogs`, если нужна диагностика устройства
- online/offline и `control_mode` устройства

Показатели:

- количество помещений: `count(Rooms where is_active = true)`
- средняя температура: последние измерения по активным комнатам
- помещения вне уставки: `abs(last_temperature - current_setpoint) >= threshold`
- активные алгоритмы: группировка `RoomSettings.algorithm_id`

## 9. Statistics Data Mapping

Statistics использует:

- `Measurements`
- `Setpoints`
- `RoomSettings`
- `Events`

Фильтры:

- rooms: список `room_id`
- period: day/week/month/custom
- dateFrom/dateTo для custom

Показатели:

- средняя температура;
- средняя ошибка регулирования;
- максимальное отклонение;
- энергопотребление;
- распределение состояний.

## 10. RoomPage Data Mapping

RoomPage использует:

- `Rooms`
- `RoomSettings`
- `RoomAlgorithmParameters`
- историю `Measurements`
- историю `Setpoints`
- последние `DeviceLogs` устройства комнаты

RoomPage должна уметь:

- показать текущую температуру;
- показать текущую уставку;
- показать активный алгоритм;
- изменить уставку;
- изменить алгоритм;
- изменить PID-параметры;
- показать график температуры за день/неделю/месяц.
- показать, что устройство находится в `local`, `remote`, `failsafe` или offline.
- при `local` режиме показывать, что изменения веб-панели сохраняются как desired config.

## 11. SettingsPage Data Mapping

SettingsPage использует:

- `SystemSettings`
- `UserSettings`
- `RegulationAlgorithms`
- `RoomSettings`
- `RoomAlgorithmParameters`

SettingsPage должна уметь:

- изменить тему интерфейса;
- изменить интервал обновления;
- изменить профиль подключения;
- назначить алгоритм всем или выбранным комнатам;
- изменить системный режим;
- изменить глобальные PID-параметры.
- изменить критическую температуру, default `35.0°C`.
- администратор должен уметь добавлять пользователей и менять роли.

## 11.1 LogsPage Data Mapping

LogsPage использует:

- `Events`
- `DeviceLogs`
- `DeviceCommands`
- `Rooms`
- `Devices`

LogsPage должна уметь фильтровать:

- по комнате;
- по устройству;
- по уровню лога;
- по типу события;
- по периоду;
- по источнику: `event`, `device_log`, `command`.

## 12. Logging Policy

Подробная спецификация логирования зафиксирована в `docs/logging-spec.md`.

Кратко:

- `Measurements` - регулярная телеметрия и данные для графиков.
- `DeviceLogs` - сырые технические логи Arduino.
- `Events` - нормализованные события для интерфейса.
- `DeviceCommands` - история команд и подтверждений.
- Arduino хранит только временный ring buffer и досылает данные batch-запросами.
- Backend обязан защищаться от дублей через `device_sequence`.

## 13. Recommended Implementation Stages

### Stage 1: Mock Repository

- Разнести текущие моковые данные по `data/mockData.ts`.
- Создать services и repositories.
- Оставить хранение в памяти.

### Stage 2: PostgreSQL + Prisma

- Подключить Prisma.
- Создать миграции по этой спецификации.
- Добавить seed-данные.

### Stage 3: Frontend Mutations

- Подключить изменение уставки.
- Подключить изменение алгоритма.
- Подключить изменение PID.
- Подключить SettingsPage к реальным mutation.

### Stage 4: Controller REST API

- Добавить `/api/devices/:deviceUid/telemetry`.
- Добавить `/api/devices/:deviceUid/telemetry/batch`.
- Добавить `/api/devices/:deviceUid/heartbeat`.
- Добавить `/api/devices/:deviceUid/logs/batch`.
- Добавить `/api/devices/:deviceUid/commands`.
- Добавить `/api/devices/:deviceUid/commands/:commandId/ack`.

### Stage 5: Reliability

- Добавить offline detection.
- Добавить expiration команд.
- Добавить Events.
- Добавить DeviceLogs.
- Добавить защиту от дублей по `device_sequence`.
- Добавить базовую авторизацию пользователей.

### Stage 6: Optional MQTT

Если устройств станет больше или понадобится более быстрый обмен:

```txt
Arduino <-> MQTT broker <-> Backend <-> Database
```

REST API при этом можно оставить как fallback.

## 14. Open Questions

- Нужно ли хранить расписания уставок по времени?
- Будет ли общий `device_sequence` для telemetry и logs или отдельные sequence по потокам?
- Нужно ли показывать сырые `DeviceLogs` пользователю или только администратору?

## 15. Possible Future Tables

Если проект расширится, можно добавить:

```txt
Schedules
Notifications
Floors
Buildings
DeviceFirmwareUpdates
AuditLog
HourlyMeasurementAggregates
DailyMeasurementAggregates
```

Пока эти таблицы не обязательны для первой рабочей версии.
Важно:

- если комната в `local`, команды изменения уставки/алгоритма не должны принудительно применяться;
- веб-панель может сохранить desired config в `RoomSettings`;
- когда контроллер сообщает переход в `remote`, backend создаёт или активирует команды для desired config.
