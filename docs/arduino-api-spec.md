# Arduino/Controller API Specification

Версия: 1.1  
Проект: Climate Controller  
Назначение: описать REST API для контроллера и сразу заложить совместимость с будущим переходом на MQTT.

## 1. Контекст

В рамках курсовой устройство может быть одно, но архитектура должна поддерживать несколько контроллеров.

Основное целевое устройство:

- Renesas RA4M1 как вычислительное ядро;
- ESP32-S3 Mini как Wi-Fi модуль, который выполняет HTTP-запросы к backend;
- совместимость по архитектуре с Arduino UNO WiFi Rev5.

В первой версии:

- одна комната имеет одно устройство;
- используется только датчик температуры DS18B20;
- используется только нагреватель через MOSFET;
- влажность, CO2, качество воздуха, охлаждение, вентиляция и увлажнение остаются future-compatible полями.

Backend остаётся центральной точкой обмена:

```txt
Controller -> REST API backend -> PostgreSQL
Frontend   -> tRPC backend     -> PostgreSQL
Backend    -> REST polling     -> Controller
```

В будущем REST polling можно заменить MQTT:

```txt
Controller <-> MQTT broker <-> Backend <-> PostgreSQL
```

В первой версии реализуется только REST API. MQTT не реализуется, но JSON payload-ы должны быть совместимы с будущими MQTT topics.

## 2. Главный Принцип Проектирования

REST API проектируется как транспорт для сообщений.

То есть мы не привязываем данные только к HTTP. Каждый payload должен быть пригоден и для MQTT.

```txt
REST endpoint = временный транспорт
MQTT topic    = будущий транспорт
JSON payload  = общий контракт
```

Пример:

```txt
REST: POST /api/devices/:deviceUid/telemetry/batch
MQTT: climate/devices/:deviceUid/telemetry
Body: одинаковый JSON
```

## 3. Режимы Управления

Контроллер поддерживает два режима:

### local

Локальный режим.

Уставка задаётся потенциометром, режим переключается кнопкой, текущее состояние отображается на LCD/LED.

Backend может мониторить устройство, но не должен силой перезаписывать локальную уставку, если контроллер находится в `local`.

Когда пользователь меняет настройки через веб-панель в `local` режиме, backend сохраняет их как desired config. Эти изменения применяются только после того, как контроллер сам перейдёт обратно в `remote`.

### remote

Дистанционный режим.

Уставка, PID-параметры и режим работы могут приходить из веб-приложения через backend.

Переход из `local` в `remote` выполняется только на устройстве физической кнопкой. Веб-панель не должна принудительно переключать контроллер из `local` в `remote`.

### failsafe

Аварийный или защитный режим.

Например, при перегреве контроллер отключает исполнительное устройство независимо от команд backend.

Backend должен отображать это состояние и логировать событие.

## 4. Общие Поля Сообщения

Каждое сообщение от контроллера должно содержать общий envelope.

```json
{
  "protocolVersion": "1.0",
  "messageId": "arduino-203-000001",
  "deviceUid": "arduino-203",
  "deviceSequence": 1,
  "deviceUptimeMs": 120000
}
```

Поля:

| Field | Type | Required | Notes |
|---|---:|---:|---|
| protocolVersion | string | yes | версия API, например `1.0` |
| messageId | string | yes | id сообщения, уникален в рамках устройства |
| deviceUid | string | yes | внешний id устройства |
| deviceSequence | number | yes | монотонно растущий номер сообщения |
| deviceUptimeMs | number | yes | uptime устройства с момента старта |
| deviceTime | string | no | ISO datetime, если у устройства есть точное время |

Важно:

- `deviceSequence` нужен для защиты от дублей.
- `deviceUptimeMs` нужен, потому что у контроллера может не быть RTC.
- Backend всегда добавляет своё `received_at`.

## 4.1 Интервалы Первой Версии

```txt
telemetryIntervalMs: 5000
heartbeatIntervalMs: 30000
commandPollIntervalMs: 5000
logBatchIntervalMs: 30000
controlCycleMs: задаётся прошивкой, рекомендуемое стартовое значение 1000
```

Эти значения должны приходить в bootstrap/config и могут быть изменены через backend-настройки.

## 5. Авторизация

В REST-режиме контроллер передаёт ключ устройства:

```txt
X-Device-Key: <device-api-key>
```

Backend хранит только hash ключа в `Devices.api_key_hash`.

В MQTT-режиме аналог:

- device username/password на broker;
- или client certificate;
- или token в username/password.

Для курсовой версии достаточно `X-Device-Key` в REST API.

## 6. REST Endpoints

Базовый prefix:

```txt
/api/devices/:deviceUid
```

## 6.1 Health Check

Проверка доступности backend.

```txt
GET /api/devices/:deviceUid/ping
```

Response:

```json
{
  "ok": true,
  "serverTime": "2026-06-08T12:00:00.000Z"
}
```

MQTT equivalent:

```txt
climate/devices/:deviceUid/ping
climate/devices/:deviceUid/pong
```

## 6.2 Device Bootstrap

Контроллер сообщает backend-у сведения о себе после старта.

```txt
POST /api/devices/:deviceUid/bootstrap
```

Request:

```json
{
  "protocolVersion": "1.0",
  "messageId": "arduino-203-000001",
  "deviceUid": "arduino-203",
  "deviceSequence": 1,
  "deviceUptimeMs": 1500,
  "hardware": {
    "controller": "Renesas RA4M1",
    "wifiModule": "ESP32-S3 Mini",
    "temperatureSensor": "DS18B20",
    "display": "LCD_I2C",
    "heaterDriver": "MOSFET"
  },
  "firmware": {
    "version": "0.1.0",
    "build": "coursework-prototype"
  },
  "capabilities": {
    "localControl": true,
    "remoteControl": true,
    "pid": true,
    "temperature": true,
    "humidity": false,
    "co2": false,
    "airQuality": false,
    "heater": true,
    "cooler": false,
    "humidifier": false,
    "ventilation": false
  }
}
```

Response:

```json
{
  "accepted": true,
  "serverTime": "2026-06-08T12:00:00.000Z",
  "device": {
    "deviceUid": "arduino-203",
    "roomId": 203
  },
  "config": {
    "telemetryIntervalMs": 5000,
    "heartbeatIntervalMs": 30000,
    "commandPollIntervalMs": 5000,
    "logBatchIntervalMs": 30000,
    "criticalTemperature": 35.0
  }
}
```

Backend actions:

- проверяет устройство;
- обновляет `Devices.last_seen_at`;
- обновляет `Devices.firmware_version`;
- создаёт `DeviceLogs.boot`;
- создаёт `Events.device_online`, если устройство было offline.

MQTT equivalent:

```txt
Controller -> climate/devices/:deviceUid/bootstrap
Backend    -> climate/devices/:deviceUid/bootstrap/accepted
```

## 6.3 Heartbeat

Короткое сообщение, что контроллер жив.

```txt
POST /api/devices/:deviceUid/heartbeat
```

Request:

```json
{
  "protocolVersion": "1.0",
  "messageId": "arduino-203-000010",
  "deviceUid": "arduino-203",
  "deviceSequence": 10,
  "deviceUptimeMs": 180000,
  "status": {
    "controlMode": "remote",
    "systemState": "normal",
    "wifiRssi": -61,
    "freeMemory": 512
  }
}
```

Response:

```json
{
  "accepted": true,
  "serverTime": "2026-06-08T12:00:00.000Z",
  "hasPendingCommands": true
}
```

MQTT equivalent:

```txt
Controller -> climate/devices/:deviceUid/heartbeat
Backend    -> climate/devices/:deviceUid/heartbeat/ack
```

## 6.4 Telemetry Batch

Основной endpoint для измерений.

```txt
POST /api/devices/:deviceUid/telemetry/batch
```

Request:

```json
{
  "protocolVersion": "1.0",
  "messageId": "arduino-203-telemetry-000020",
  "deviceUid": "arduino-203",
  "deviceSequence": 20,
  "deviceUptimeMs": 250000,
  "readings": [
    {
      "sampleSequence": 101,
      "sampleUptimeMs": 240000,
      "temperature": 22.8,
      "humidity": null,
      "outsideTemperature": null,
      "setpointValue": 23.0,
      "controlMode": "remote",
      "setpointSource": "remote",
      "algorithm": "PID",
      "power": 0.8,
      "actuators": {
        "heater": true,
        "cooler": false,
        "humidifier": false,
        "ventilation": false
      },
      "pid": {
        "kp": 1.2,
        "ki": 0.35,
        "kd": 0.08,
        "error": 0.2,
        "output": 0.61
      },
      "safety": {
        "overheat": false,
        "emergencyShutdown": false,
        "criticalTemperature": 35.0
      }
    }
  ]
}
```

Response:

```json
{
  "accepted": 1,
  "duplicates": 0,
  "failed": 0,
  "serverTime": "2026-06-08T12:00:00.000Z"
}
```

Backend actions:

- валидирует `deviceUid` и `X-Device-Key`;
- сохраняет записи в `Measurements`;
- игнорирует дубли по sequence;
- обновляет `Devices.last_seen_at`;
- обновляет online/offline статус;
- создаёт `Events`, если есть перегрев или аварийное отключение.
- если `controlMode = local`, обновляет состояние комнаты и помечает веб-панель как не управляющую устройством.

MQTT equivalent:

```txt
Controller -> climate/devices/:deviceUid/telemetry
Backend    -> climate/devices/:deviceUid/telemetry/ack
```

## 6.5 State Report

Полный снимок текущего состояния контроллера.

Используется после старта, после изменения режима, после команды `REQUEST_STATUS`.

```txt
POST /api/devices/:deviceUid/state
```

Request:

```json
{
  "protocolVersion": "1.0",
  "messageId": "arduino-203-state-000030",
  "deviceUid": "arduino-203",
  "deviceSequence": 30,
  "deviceUptimeMs": 310000,
  "state": {
    "controlMode": "remote",
    "systemState": "normal",
    "temperature": 22.8,
    "setpointValue": 23.0,
    "localSetpointValue": 21.5,
    "remoteSetpointValue": 23.0,
    "setpointSource": "remote",
    "algorithm": "PID",
    "cycleMs": 1000,
    "display": {
      "type": "LCD_I2C",
      "enabled": true
    },
    "inputs": {
      "potentiometerRaw": 612,
      "modeButtonPressed": false
    },
    "actuators": {
      "heater": true,
      "heaterPwm": 156
    },
    "safety": {
      "overheat": false,
      "emergencyShutdown": false,
      "criticalTemperature": 35.0
    }
  }
}
```

Response:

```json
{
  "accepted": true
}
```

MQTT equivalent:

```txt
Controller -> climate/devices/:deviceUid/state
Backend    -> climate/devices/:deviceUid/state/ack
```

Backend actions:

- обновляет `RoomSettings.control_mode`;
- если пришёл переход в `local`, веб-панель должна показать, что дистанционное управление отключено;
- если пришёл переход в `remote`, backend может создать команды для применения накопленной desired config;
- если пришёл `failsafe`, backend создаёт событие аварии и не отправляет опасные команды.

## 6.6 Device Logs Batch

Технические логи контроллера.

```txt
POST /api/devices/:deviceUid/logs/batch
```

Request:

```json
{
  "protocolVersion": "1.0",
  "messageId": "arduino-203-logs-000040",
  "deviceUid": "arduino-203",
  "deviceSequence": 40,
  "deviceUptimeMs": 350000,
  "logs": [
    {
      "logSequence": 501,
      "level": "info",
      "type": "wifi_connected",
      "message": "WiFi connected",
      "uptimeMs": 5000,
      "payload": {
        "rssi": -62
      }
    },
    {
      "logSequence": 502,
      "level": "warning",
      "type": "sensor_read_retry",
      "message": "DS18B20 retry",
      "uptimeMs": 8000,
      "payload": {
        "attempt": 2
      }
    }
  ]
}
```

Response:

```json
{
  "accepted": 2,
  "duplicates": 0,
  "failed": 0
}
```

MQTT equivalent:

```txt
Controller -> climate/devices/:deviceUid/logs
Backend    -> climate/devices/:deviceUid/logs/ack
```

## 6.7 Get Commands

REST polling для получения команд.

```txt
GET /api/devices/:deviceUid/commands?limit=5
```

Response:

```json
{
  "commands": [
    {
      "commandId": 123,
      "type": "SET_SETPOINT",
      "createdAt": "2026-06-08T12:00:00.000Z",
      "expiresAt": "2026-06-08T12:05:00.000Z",
      "payload": {
        "setpointValue": 23.0
      }
    }
  ]
}
```

Backend actions:

- выбирает `DeviceCommands.status = pending`;
- переводит выбранные команды в `sent`;
- заполняет `sent_at`.

MQTT equivalent:

```txt
Backend -> climate/devices/:deviceUid/commands
```

В MQTT polling не нужен: backend публикует команду сразу.

## 6.8 Acknowledge Command

Контроллер подтверждает результат команды.

```txt
POST /api/devices/:deviceUid/commands/:commandId/ack
```

Request:

```json
{
  "protocolVersion": "1.0",
  "messageId": "arduino-203-ack-000050",
  "deviceUid": "arduino-203",
  "deviceSequence": 50,
  "deviceUptimeMs": 380000,
  "success": true,
  "status": "applied",
  "message": "Setpoint applied",
  "appliedState": {
    "controlMode": "remote",
    "setpointValue": 23.0,
    "algorithm": "PID"
  }
}
```

Response:

```json
{
  "accepted": true
}
```

MQTT equivalent:

```txt
Controller -> climate/devices/:deviceUid/commands/:commandId/ack
```

## 7. Command Types

Команды должны быть максимально близки к будущим MQTT messages.

## 7.1 SET_SETPOINT

Изменить удалённую уставку.

```json
{
  "type": "SET_SETPOINT",
  "payload": {
    "setpointValue": 23.0
  }
}
```

Правила:

- применяется только в `remote`;
- в `local` backend не должен отправлять команду сразу, а должен сохранить `desired_setpoint`;
- если команда всё же пришла в `local`, контроллер отклоняет её со статусом `rejected_local_mode`;
- не должна отключать защиту от перегрева.

## 7.2 SET_CONTROL_MODE

Команда оставлена для совместимости, но в первой версии backend не должен принудительно переключать контроллер из `local` в `remote`.

Переход `local -> remote` выполняется только на устройстве физической кнопкой. Контроллер сообщает об этом через `POST /state`.

Допустимо использовать эту команду только для будущих сценариев, если аппаратная логика это разрешит.

```json
{
  "type": "SET_CONTROL_MODE",
  "payload": {
    "controlMode": "remote"
  }
}
```

Допустимые значения:

```txt
local
remote
```

## 7.3 SET_PID_PARAMS

Изменить PID-параметры.

```json
{
  "type": "SET_PID_PARAMS",
  "payload": {
    "kp": 1.2,
    "ki": 0.35,
    "kd": 0.08,
    "hysteresis": 0.4
  }
}
```

## 7.4 SET_CYCLE_CONFIG

Изменить параметры дискретного цикла управления.

```json
{
  "type": "SET_CYCLE_CONFIG",
  "payload": {
    "controlCycleMs": 1000,
    "telemetryIntervalMs": 5000
  }
}
```

## 7.5 SET_SAFETY_LIMITS

Изменить аварийные ограничения.

```json
{
  "type": "SET_SAFETY_LIMITS",
  "payload": {
    "criticalTemperature": 35.0,
    "restoreTemperature": 32.0
  }
}
```

Важно:

- backend не должен отправлять небезопасные значения;
- контроллер должен иметь собственные hardcoded safety limits.
- стартовое значение `criticalTemperature` для проекта: `35.0°C`;
- значение должно быть изменяемым через настройки, но контроллер всё равно должен иметь абсолютный безопасный максимум в прошивке.

## 7.6 REQUEST_STATUS

Запросить полный state report.

```json
{
  "type": "REQUEST_STATUS",
  "payload": {}
}
```

## 7.7 REBOOT_DEVICE

Перезагрузить контроллер.

```json
{
  "type": "REBOOT_DEVICE",
  "payload": {
    "delayMs": 1000
  }
}
```

## 8. Status Values

### controlMode

```txt
local
remote
failsafe
```

### systemState

```txt
normal
heating
stable
overheat
sensor_error
offline
error
```

### setpointSource

```txt
potentiometer
remote
default
failsafe
```

### command ack status

```txt
applied
rejected_local_mode
rejected_invalid_payload
rejected_safety
queued_desired_config
failed
expired
```

## 9. Error Format

Все REST ошибки backend возвращает в одном формате.

```json
{
  "error": {
    "code": "DEVICE_AUTH_FAILED",
    "message": "Invalid device key",
    "details": {}
  }
}
```

Примеры кодов:

```txt
DEVICE_NOT_FOUND
DEVICE_AUTH_FAILED
DEVICE_INACTIVE
INVALID_PAYLOAD
DUPLICATE_MESSAGE
COMMAND_NOT_FOUND
COMMAND_EXPIRED
INTERNAL_ERROR
```

## 10. MQTT Migration Mapping

REST API и MQTT должны использовать одинаковые JSON payload-ы.

| REST | MQTT topic | Direction |
|---|---|---|
| `POST /bootstrap` | `climate/devices/:deviceUid/bootstrap` | controller -> backend |
| `POST /heartbeat` | `climate/devices/:deviceUid/heartbeat` | controller -> backend |
| `POST /telemetry/batch` | `climate/devices/:deviceUid/telemetry` | controller -> backend |
| `POST /state` | `climate/devices/:deviceUid/state` | controller -> backend |
| `POST /logs/batch` | `climate/devices/:deviceUid/logs` | controller -> backend |
| `GET /commands` | `climate/devices/:deviceUid/commands` | backend -> controller |
| `POST /commands/:id/ack` | `climate/devices/:deviceUid/commands/:commandId/ack` | controller -> backend |

MQTT recommendations:

- telemetry QoS: 1;
- commands QoS: 1;
- command ack QoS: 1;
- heartbeat QoS: 0 or 1;
- retained commands: no;
- retained desired config: optional later.

## 11. Backend Persistence Mapping

| Message | Tables |
|---|---|
| bootstrap | `Devices`, `DeviceLogs`, `Events` |
| heartbeat | `Devices`, optionally `Events` |
| telemetry/batch | `Measurements`, `Events` for abnormal states |
| state | `RoomSettings`, desired config activation, `DeviceLogs`, optionally `Events` |
| logs/batch | `DeviceLogs`, optionally `Events` |
| commands | `DeviceCommands` |
| command ack | `DeviceCommands`, `Events`, optionally `DeviceLogs` |

## 12. Safety Rules

- Перегрев обрабатывается локально на контроллере.
- При `temperature >= criticalTemperature` контроллер обязан отключить нагреватель.
- Backend не должен требовать включения нагревателя при активном `emergencyShutdown`.
- В `failsafe` контроллер может игнорировать команды уставки и алгоритма.
- После перегрева контроллер должен отправить telemetry/state с `safety.overheat = true`.
- Backend должен создать `Events.temperature_too_high` или `Events.emergency_shutdown`.
- `criticalTemperature` по умолчанию равна `35.0°C`.
- Пользователь может изменить `criticalTemperature` в настройках, но прошивка должна иметь hardcoded абсолютный максимум.

## 12.1 Desired Config In Local Mode

Если контроллер находится в `local`:

- веб-панель показывает, что remote control неактивен;
- пользователь может менять уставку/алгоритм/PID в веб-панели;
- backend сохраняет эти изменения как desired config;
- backend не отправляет команды, которые принудительно изменят локальный режим;
- при следующем `state.controlMode = remote` backend создаёт команды для применения desired config.

Рекомендуемые события:

```txt
device_control_mode_changed
desired_config_queued
desired_config_applied
```

## 13. Minimal Controller Loop

```txt
setup:
  load device config
  connect Wi-Fi
  send bootstrap
  request commands/status

loop:
  read local inputs
  read DS18B20 temperature
  update control mode
  run discrete PID/control cycle
  apply safety protection
  update LCD/LED indication
  add telemetry to local buffer

  if Wi-Fi connected:
    send heartbeat if due
    send telemetry batch if due
    send logs batch if due
    poll commands if due
    apply commands
    send command ack
  else:
    keep local control
    keep buffering within limits
```

## 14. Implementation Priority

Для первой версии backend достаточно:

1. `POST /bootstrap`.
2. `POST /heartbeat`.
3. `POST /telemetry/batch`.
4. `GET /commands`.
5. `POST /commands/:commandId/ack`.
6. `POST /logs/batch`.
7. `POST /state`.

`POST /state` важен для синхронизации `local`/`remote`/`failsafe` и применения desired config.

## 15. Open Questions

- Нужна ли синхронизация времени через backend/serverTime?
- Будет ли контроллер хранить telemetry buffer только в RAM или нужна SD-карта?
- Какие hardcoded safety limits должны быть в прошивке?
