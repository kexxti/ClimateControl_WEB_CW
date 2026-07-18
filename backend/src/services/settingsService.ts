import type { Algorithm, ClimateMode, PidParams } from '../types/climate';
import {
  applyAlgorithmToRooms,
  getSettings,
  updateApplicationSettings,
  updateSystemSettings,
} from '../repositories/settingsRepository';

export const changeApplicationSettings = (settings: {
  theme: string;
  refreshInterval: string;
  connectionProfile: string;
}, userId: bigint) => {
  return updateApplicationSettings(userId, settings);
};

export const getSettingsData = (userId: bigint) => getSettings(userId);

export const changeSystemSettings = (settings: {
  algorithm: Algorithm;
  mode: ClimateMode;
  pidPreset: string;
  applyTarget: string;
  pidParams: PidParams;
}, userId: bigint) => {
  return updateSystemSettings(userId, settings);
};

export const applyAlgorithm = (input: {
  algorithm: Algorithm;
  target: 'all' | 'selected' | 'floor';
  roomIDs?: string[];
  floor?: number;
}) => {
  return applyAlgorithmToRooms(input);
};
