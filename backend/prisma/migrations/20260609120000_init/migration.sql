CREATE TYPE "UserRole" AS ENUM ('admin', 'user');
CREATE TYPE "AlgorithmCode" AS ENUM ('PID', 'ON_OFF', 'TIME', 'ML');
CREATE TYPE "RoomStatus" AS ENUM ('heating', 'cooling', 'stable', 'offline', 'error');
CREATE TYPE "ClimateMode" AS ENUM ('standard', 'energy_saving', 'night', 'manual');
CREATE TYPE "ControlMode" AS ENUM ('local', 'remote', 'failsafe');
CREATE TYPE "CommandType" AS ENUM (
  'SET_SETPOINT',
  'SET_ALGORITHM',
  'SET_PID_PARAMS',
  'SET_MODE',
  'SET_CONTROL_MODE',
  'SET_CYCLE_CONFIG',
  'SET_SAFETY_LIMITS',
  'REBOOT_DEVICE',
  'REQUEST_STATUS'
);
CREATE TYPE "CommandStatus" AS ENUM ('pending', 'sent', 'acknowledged', 'failed', 'expired');
CREATE TYPE "SettingScope" AS ENUM ('system', 'user', 'room');
CREATE TYPE "EventSeverity" AS ENUM ('info', 'warning', 'error', 'critical');
CREATE TYPE "LogLevel" AS ENUM ('debug', 'info', 'warning', 'error', 'critical');
CREATE TYPE "SetpointSource" AS ENUM ('manual', 'schedule', 'algorithm', 'system');

CREATE TABLE "users" (
  "id" BIGSERIAL PRIMARY KEY,
  "login" VARCHAR(120) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'user',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_login_at" TIMESTAMPTZ(3)
);

CREATE TABLE "user_settings" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" BIGINT NOT NULL,
  "key" VARCHAR(120) NOT NULL,
  "value" JSONB NOT NULL,
  "scope" "SettingScope" NOT NULL DEFAULT 'user',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "system_settings" (
  "id" BIGSERIAL PRIMARY KEY,
  "key" VARCHAR(120) NOT NULL,
  "value" JSONB NOT NULL,
  "scope" "SettingScope" NOT NULL DEFAULT 'system',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "rooms" (
  "id" BIGSERIAL PRIMARY KEY,
  "name" VARCHAR(160) NOT NULL,
  "location" VARCHAR(255),
  "floor" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "devices" (
  "id" BIGSERIAL PRIMARY KEY,
  "room_id" BIGINT NOT NULL,
  "device_uid" VARCHAR(120) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "api_key_hash" VARCHAR(255) NOT NULL,
  "firmware_version" VARCHAR(80),
  "ip_address" VARCHAR(80),
  "last_seen_at" TIMESTAMPTZ(3),
  "is_online" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "regulation_algorithms" (
  "id" BIGSERIAL PRIMARY KEY,
  "code" "AlgorithmCode" NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" VARCHAR(500),
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "room_settings" (
  "id" BIGSERIAL PRIMARY KEY,
  "room_id" BIGINT NOT NULL,
  "current_setpoint" DECIMAL(5,2) NOT NULL,
  "desired_setpoint" DECIMAL(5,2),
  "algorithm_id" BIGINT NOT NULL,
  "desired_algorithm_id" BIGINT,
  "mode" "ClimateMode" NOT NULL DEFAULT 'standard',
  "control_mode" "ControlMode" NOT NULL DEFAULT 'remote',
  "status" "RoomStatus" NOT NULL DEFAULT 'stable',
  "critical_temperature" DECIMAL(5,2) NOT NULL DEFAULT 35.0,
  "updated_by_user_id" BIGINT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "room_algorithm_parameters" (
  "id" BIGSERIAL PRIMARY KEY,
  "room_id" BIGINT NOT NULL,
  "algorithm_id" BIGINT NOT NULL,
  "kp" DECIMAL(8,4),
  "ki" DECIMAL(8,4),
  "kd" DECIMAL(8,4),
  "hysteresis" DECIMAL(8,4),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_user_id" BIGINT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "measurements" (
  "id" BIGSERIAL PRIMARY KEY,
  "room_id" BIGINT NOT NULL,
  "device_id" BIGINT NOT NULL,
  "temperature" DECIMAL(5,2) NOT NULL,
  "humidity" DECIMAL(5,2),
  "outside_temperature" DECIMAL(5,2),
  "power" DECIMAL(8,3),
  "setpoint_value" DECIMAL(5,2),
  "heater_state" BOOLEAN,
  "cooler_state" BOOLEAN,
  "algorithm_id" BIGINT,
  "device_sequence" BIGINT,
  "device_uptime_ms" BIGINT,
  "raw_payload" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "setpoints" (
  "id" BIGSERIAL PRIMARY KEY,
  "room_id" BIGINT NOT NULL,
  "value" DECIMAL(5,2) NOT NULL,
  "source" "SetpointSource" NOT NULL DEFAULT 'system',
  "created_by_user_id" BIGINT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "device_commands" (
  "id" BIGSERIAL PRIMARY KEY,
  "device_id" BIGINT NOT NULL,
  "room_id" BIGINT NOT NULL,
  "type" "CommandType" NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "CommandStatus" NOT NULL DEFAULT 'pending',
  "created_by_user_id" BIGINT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMPTZ(3),
  "acknowledged_at" TIMESTAMPTZ(3),
  "failed_at" TIMESTAMPTZ(3),
  "expires_at" TIMESTAMPTZ(3),
  "error_message" VARCHAR(500)
);

CREATE TABLE "events" (
  "id" BIGSERIAL PRIMARY KEY,
  "room_id" BIGINT,
  "device_id" BIGINT,
  "user_id" BIGINT,
  "type" VARCHAR(120) NOT NULL,
  "severity" "EventSeverity" NOT NULL DEFAULT 'info',
  "message" VARCHAR(500) NOT NULL,
  "payload" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "device_logs" (
  "id" BIGSERIAL PRIMARY KEY,
  "device_id" BIGINT NOT NULL,
  "room_id" BIGINT,
  "level" "LogLevel" NOT NULL,
  "type" VARCHAR(120) NOT NULL,
  "message" VARCHAR(500) NOT NULL,
  "payload" JSONB,
  "device_sequence" BIGINT,
  "device_uptime_ms" BIGINT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "users_login_key" ON "users"("login");
CREATE INDEX "users_role_idx" ON "users"("role");

CREATE UNIQUE INDEX "user_settings_user_id_key_key" ON "user_settings"("user_id", "key");

CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

CREATE INDEX "rooms_name_idx" ON "rooms"("name");
CREATE INDEX "rooms_floor_idx" ON "rooms"("floor");

CREATE UNIQUE INDEX "devices_room_id_key" ON "devices"("room_id");
CREATE UNIQUE INDEX "devices_device_uid_key" ON "devices"("device_uid");
CREATE INDEX "devices_last_seen_at_idx" ON "devices"("last_seen_at");

CREATE UNIQUE INDEX "regulation_algorithms_code_key" ON "regulation_algorithms"("code");

CREATE UNIQUE INDEX "room_settings_room_id_key" ON "room_settings"("room_id");

CREATE INDEX "room_algorithm_parameters_room_id_idx" ON "room_algorithm_parameters"("room_id");
CREATE INDEX "room_algorithm_parameters_algorithm_id_idx" ON "room_algorithm_parameters"("algorithm_id");
CREATE UNIQUE INDEX "room_algorithm_parameters_room_id_algorithm_id_is_active_key"
  ON "room_algorithm_parameters"("room_id", "algorithm_id", "is_active");

CREATE INDEX "measurements_room_id_created_at_idx" ON "measurements"("room_id", "created_at");
CREATE INDEX "measurements_device_id_created_at_idx" ON "measurements"("device_id", "created_at");
CREATE INDEX "measurements_device_id_received_at_idx" ON "measurements"("device_id", "received_at");
CREATE INDEX "measurements_created_at_idx" ON "measurements"("created_at");
CREATE UNIQUE INDEX "measurements_device_id_device_sequence_key" ON "measurements"("device_id", "device_sequence");

CREATE INDEX "setpoints_room_id_created_at_idx" ON "setpoints"("room_id", "created_at");
CREATE INDEX "setpoints_created_by_user_id_idx" ON "setpoints"("created_by_user_id");

CREATE INDEX "device_commands_device_id_status_created_at_idx" ON "device_commands"("device_id", "status", "created_at");
CREATE INDEX "device_commands_room_id_created_at_idx" ON "device_commands"("room_id", "created_at");
CREATE INDEX "device_commands_created_by_user_id_idx" ON "device_commands"("created_by_user_id");

CREATE INDEX "events_room_id_created_at_idx" ON "events"("room_id", "created_at");
CREATE INDEX "events_device_id_created_at_idx" ON "events"("device_id", "created_at");
CREATE INDEX "events_severity_created_at_idx" ON "events"("severity", "created_at");

CREATE INDEX "device_logs_device_id_received_at_idx" ON "device_logs"("device_id", "received_at");
CREATE INDEX "device_logs_room_id_received_at_idx" ON "device_logs"("room_id", "received_at");
CREATE INDEX "device_logs_level_received_at_idx" ON "device_logs"("level", "received_at");
CREATE INDEX "device_logs_type_received_at_idx" ON "device_logs"("type", "received_at");

ALTER TABLE "user_settings"
  ADD CONSTRAINT "user_settings_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "devices"
  ADD CONSTRAINT "devices_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "room_settings"
  ADD CONSTRAINT "room_settings_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "room_settings_algorithm_id_fkey"
  FOREIGN KEY ("algorithm_id") REFERENCES "regulation_algorithms"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "room_settings_desired_algorithm_id_fkey"
  FOREIGN KEY ("desired_algorithm_id") REFERENCES "regulation_algorithms"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "room_settings_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "room_algorithm_parameters"
  ADD CONSTRAINT "room_algorithm_parameters_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "room_algorithm_parameters_algorithm_id_fkey"
  FOREIGN KEY ("algorithm_id") REFERENCES "regulation_algorithms"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "room_algorithm_parameters_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "measurements"
  ADD CONSTRAINT "measurements_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "measurements_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "measurements_algorithm_id_fkey"
  FOREIGN KEY ("algorithm_id") REFERENCES "regulation_algorithms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "setpoints"
  ADD CONSTRAINT "setpoints_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "setpoints_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "device_commands"
  ADD CONSTRAINT "device_commands_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "device_commands_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "device_commands_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "events"
  ADD CONSTRAINT "events_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "events_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "device_logs"
  ADD CONSTRAINT "device_logs_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "device_logs_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
