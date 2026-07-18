export type Algorithm = 'PID' | 'On/Off' | 'Time' | 'ML';

export type RoomStatus = 'heating' | 'cooling' | 'stable' | 'offline' | 'error';

export type ControlMode = 'local' | 'remote' | 'failsafe';

export type ClimateMode = 'standard' | 'energySaving' | 'energy_saving' | 'night' | 'manual';

export type StatisticsPeriod = 'day' | 'week' | 'month' | 'custom';

export type RoomPeriod = 'day' | 'week' | 'month';

export const algorithmOptions: Algorithm[] = ['PID', 'On/Off', 'Time', 'ML'];

export const roomStatusLabel: Record<RoomStatus, string> = {
  heating: 'Нагрев',
  cooling: 'Охлаждение',
  stable: 'Поддержка',
  offline: 'Оффлайн',
  error: 'Ошибка',
};

export const dashboardRoomStatusLabel: Record<RoomStatus, string> = {
  ...roomStatusLabel,
  cooling: 'Охлажд.',
};

export const controlModeLabel: Record<ControlMode, string> = {
  local: 'Локальный',
  remote: 'Дистанционный',
  failsafe: 'Аварийный',
};

export const compactControlModeLabel: Record<ControlMode, string> = {
  local: 'Local',
  remote: 'Remote',
  failsafe: 'Failsafe',
};

export const climateModeLabel: Record<ClimateMode, string> = {
  standard: 'Обычный',
  energySaving: 'Энергосберегающий',
  energy_saving: 'Энергосберегающий',
  night: 'Ночной',
  manual: 'Ручной',
};

export const statisticsPeriodLabel: Record<StatisticsPeriod, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
  custom: 'Выбрать период',
};

export const roomPeriodLabel: Record<RoomPeriod, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
};
