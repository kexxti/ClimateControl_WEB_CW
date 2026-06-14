import type { Algorithm, ClimateMode, PidParams } from '../types/climate';
import {
  applyAlgorithmToRooms,
  getSettings,
  updateApplicationSettings,
  updateSystemSettings,
} from '../repositories/settingsRepository';

export const getSettingsData = () => getSettings();

export const changeApplicationSettings = (settings: {
  theme: string;
  refreshInterval: string;
  connectionProfile: string;
}) => {
  return updateApplicationSettings(settings);
};

export const changeSystemSettings = (settings: {
  algorithm: Algorithm;
  mode: ClimateMode;
  pidPreset: string;
  applyTarget: string;
  pidParams: PidParams;
}) => {
  return updateSystemSettings(settings);
};

export const applyAlgorithm = (input: {
  algorithm: Algorithm;
  target: 'all' | 'selected' | 'floor';
  roomIDs?: string[];
  floor?: number;
}) => {
  return applyAlgorithmToRooms(input);
};
