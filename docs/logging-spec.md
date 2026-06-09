# Logging Specification

Версия: 1.2  
Проект: Climate Controller  
Назначение: определить, какие данные логируются на backend, в базе данных, на веб-панели и на контроллере.

## 1. Цель Логирования

Логирование нужно для четырёх задач:

- строить графики и аналитику по температуре;
- видеть состояние Arduino-контроллеров;
- понимать, какие команды были отправлены и применены;
- диагностировать ошибки датчиков, связи и алгоритмов.

Главное правило:

```txt
Database на backend - основное долговременное хранилище.
Контроллер - только временный локальный буфер на случай потери связи.
```

Контроллер не должен быть главным источником истории. Если связь пропала, он временно копит данные и досылает их позже.

REST-контракт контроллера и будущая MQTT mapping описаны в `docs/arduino-api-spec.md`.

## 2. Виды Логов

В проекте есть пять разных потоков логирования.

### 2.1 Measurements

Регулярная телеметрия от устройства.

Хранится в таблице `Measurements`.

Примеры:

- температура;
- влажность;
- внешняя температура;
- мощность;
- состояние нагревателя;
- состояние охлаждения;
- текущая уставка;
- активный алгоритм.

Используется для:

- Dashboard;
- RoomPage;
- Statistics;
- графиков;
- расчёта ошибки регулирования.

### 2.2 DeviceLogs

Сырые логи контроллера.

Хранятся в таблице `DeviceLogs`.

Примеры:

- `boot`;
- `wifi_connected`;
- `wifi_disconnected`;
- `sensor_read_failed`;
- `command_applied`;
- `command_failed`;
- `low_memory`;
- `buffer_overflow`.

Это технический журнал устройства.

### 2.3 Events

Нормализованные события системы.

Хранятся в таблице `Events`.

Примеры:

- `device_online`;
- `device_offline`;
- `temperature_too_high`;
- `setpoint_changed`;
- `algorithm_changed`;
- `command_acknowledged`;
- `command_failed`.

`Events` должны быть понятны пользователю веб-панели.

### 2.4 DeviceCommands

История команд, отправляемых на Arduino.

Хранится в таблице `DeviceCommands`.

Примеры команд:

- изменить уставку;
- изменить алгоритм;
- изменить PID-параметры;
- перезагрузить устройство;
- запросить статус.

### 2.5 User Audit Events

Действия пользователя в веб-панели.

В первой версии можно хранить в `Events`.

Примеры:

- пользователь изменил уставку;
- пользователь изменил алгоритм;
- пользователь применил алгоритм ко всем аудиториям;
- пользователь изменил системные настройки.

Если проект расширится, можно добавить отдельную таблицу `AuditLogs`.

## 3. Что Логируется На Контроллере

Контроллер хранит временный локальный буфер.

Минимальные локальные записи:

```txt
sequence
uptimeMs
level
type
message
payload
```

Пример локального лога:

```json
{
  "sequence": 42,
  "uptimeMs": 125000,
  "level": "info",
  "type": "wifi_connected",
  "message": "WiFi connected"
}
```

### 3.1 Ring Buffer

Arduino должна хранить последние N записей в памяти.

Для курсовой версии достаточно:

```txt
telemetry buffer: 20-50 записей
device log buffer: 20-50 записей
```

Если буфер переполнен:

- самая старая запись удаляется;
- создаётся лог `buffer_overflow`;
- счётчик потерянных записей можно отправить в `payload`.

### 3.2 EEPROM

Не нужно часто писать телеметрию в EEPROM.

EEPROM можно использовать только для редких данных:

- `device_uid`;
- `device_api_key`;
- последняя применённая уставка;
- последняя конфигурация;
- последний sequence number.

Причина: EEPROM имеет ограниченный ресурс записи.

## 4. Sequence Numbers

Каждая запись от Arduino должна иметь `deviceSequence`.

Цель:

- защита от дублей;
- диагностика пропусков;
- корректная досылка batch-запросов после потери связи.

Правила:

- `deviceSequence` увеличивается на 1 для каждой telemetry/log записи;
- sequence хранится отдельно для telemetry и device logs либо общий для всех исходящих сообщений;
- backend должен уметь игнорировать дубли.

Рекомендуемая уникальность в базе:

```txt
Measurements: unique(device_id, device_sequence)
DeviceLogs:   unique(device_id, device_sequence)
```

Если в одной последовательности смешиваются telemetry и logs, можно добавить `stream`.

## 5. Время

У контроллера может не быть точного времени.

Поэтому используется две временные отметки:

```txt
device_uptime_ms - сколько миллисекунд устройство работает с момента старта
received_at      - когда backend получил запись
```

Для таблиц:

- `created_at` - время события, если устройство его прислало или backend его вычислил;
- `received_at` - точное backend-время при получении.

В первой версии можно считать:

```txt
created_at = received_at
```

Но поля `device_uptime_ms` и `received_at` лучше заложить сразу.

## 6. REST API Для Логирования

ESP32-S3 общается с backend через REST API.

Все запросы от контроллера должны иметь:

```txt
X-Device-Key: <device-api-key>
```

Backend проверяет:

- существует ли `device_uid`;
- активен ли device;
- совпадает ли API key;
- привязано ли устройство к комнате.

### 6.1 Telemetry Single

```txt
POST /api/devices/:deviceUid/telemetry
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

- создаёт `Measurements`;
- обновляет `Devices.last_seen_at`;
- выставляет `Devices.is_online = true`;
- обновляет текущий статус комнаты при необходимости;
- создаёт `Events.telemetry_received` только если событие важно или включён debug mode.

### 6.2 Telemetry Batch

```txt
POST /api/devices/:deviceUid/telemetry/batch
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

Backend должен принимать повторную отправку batch без создания дублей.

### 6.3 Device Logs Batch

```txt
POST /api/devices/:deviceUid/logs/batch
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

- создаёт записи `DeviceLogs`;
- для важных логов создаёт `Events`;
- обновляет `Devices.last_seen_at`.

### 6.4 Heartbeat

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

- обновляет `Devices.last_seen_at`;
- выставляет `Devices.is_online = true`;
- если устройство было offline, создаёт `Events.device_online`.

## 7. Offline Detection

Backend должен периодически проверять устройства.

Настройка:

```txt
telemetry_timeout_seconds
```

Пример:

```txt
если now() - Devices.last_seen_at > telemetry_timeout_seconds,
то устройство считается offline
```

Backend actions:

- выставить `Devices.is_online = false`;
- выставить `RoomSettings.status = offline`, если это основное устройство комнаты;
- создать `Events.device_offline`.

## 8. Уровни Логов

### debug

Подробная техническая информация.

Примеры:

- значение внутренней переменной;
- результат вычисления PID;
- подробный ответ датчика.

Обычно не показывается на Dashboard.

### info

Нормальные события.

Примеры:

- устройство загрузилось;
- WiFi подключён;
- команда применена.

### warning

Проблема, но система ещё работает.

Примеры:

- временная потеря WiFi;
- пропуск измерения;
- температура близка к лимиту.

### error

Ошибка, требующая внимания.

Примеры:

- датчик не отвечает;
- команда не применена;
- API key неверный.

### critical

Критическая ситуация.

Примеры:

- устройство долго offline;
- температура вышла за безопасные границы;
- постоянная ошибка датчика.

## 9. Отображение На Веб-Панели

### Dashboard

Показывать только последние важные события:

- `warning`;
- `error`;
- `critical`;
- последние `device_offline`;
- последние `command_failed`.

### RoomPage

Показывать:

- график `Measurements`;
- текущий online/offline статус устройства;
- последние события этой комнаты;
- последние команды для устройства.

### Statistics

Использовать:

- `Measurements`;
- агрегаты по `Measurements`;
- распределение статусов из `Events` или `RoomSettings`.

### Logs Page

В первой версии нужно добавить отдельную страницу `Logs`.

Фильтры:

- room;
- device;
- level;
- event type;
- period;
- source: `measurement`, `device_log`, `event`, `command`.

## 10. Частоты Отправки

Рекомендуемые значения для курсовой:

```txt
telemetry:       каждые 5 секунд
heartbeat:       каждые 30 секунд
command polling: каждые 5 секунд
logs batch:      по событию или каждые 30 секунд
```

Если соединения нет:

- telemetry и logs складываются в ring buffer;
- при восстановлении связи отправляются batch-запросом;
- если buffer overflow, backend получит лог `buffer_overflow`.

## 11. Retention Policy

Для курсовой версии можно хранить всё без удаления.

Для более реальной версии:

```txt
Measurements: 90-365 дней
DeviceLogs debug/info: 14-30 дней
DeviceLogs warning/error/critical: 180-365 дней
Events: 365 дней или бессрочно
DeviceCommands: 365 дней
```

Агрегаты для старых измерений можно хранить отдельно:

```txt
hourly_measurement_aggregates
daily_measurement_aggregates
```

Пока эти таблицы не обязательны.

## 12. Минимальный План Реализации

1. Добавить поля `device_sequence`, `device_uptime_ms`, `received_at` в `Measurements`.
2. Добавить таблицу `DeviceLogs`.
3. Добавить REST endpoint `/api/devices/:deviceUid/telemetry/batch`.
4. Добавить REST endpoint `/api/devices/:deviceUid/logs/batch`.
5. Добавить backend-логику защиты от дублей по `(device_id, device_sequence)`.
6. Добавить `Events` для offline/online и ошибок.
7. Добавить на Dashboard блок последних важных событий.
8. Добавить отдельную страницу Logs с фильтрами.

## 13. Минимальный Flow Контроллера

```txt
loop:
  read sensor
  add telemetry to local buffer
  if WiFi connected:
    send telemetry batch
    send device logs batch
    get pending commands
    apply commands
    send command acknowledgements
  else:
    keep buffering
```

Контроллер должен продолжать управлять локально последней известной уставкой, даже если backend временно недоступен.
