import { getRooms } from '../repositories/roomRepository';
import { getDashboardData } from './dashboardService';

export const getStatisticsData = async () => {
  const rooms = await getRooms();
  const dashboardData = await getDashboardData();
  const setpointComparison = rooms.map((room) => ({
    roomID: room.roomID,
    name: room.name,
    currentTemp: room.currentTemp,
    setpoint: room.setpoint,
    error: Number(Math.abs(room.currentTemp - room.setpoint).toFixed(1)),
  }));
  const stateDistribution = [
    { status: 'heating', label: 'Нагрев', value: rooms.filter((room) => room.status === 'heating').length },
    { status: 'cooling', label: 'Охлаждение', value: rooms.filter((room) => room.status === 'cooling').length },
    { status: 'stable', label: 'Поддержка', value: rooms.filter((room) => room.status === 'stable').length },
  ];
  const errors = setpointComparison.map((room) => room.error);
  const avgError = errors.length > 0 ? errors.reduce((sum, error) => sum + error, 0) / errors.length : 0;
  const maxDeviation = errors.length > 0 ? Math.max(...errors) : 0;
  const energyConsumption = rooms.reduce((sum, room) => sum + Math.abs(room.currentTemp - room.setpoint) * 1.8 + 2, 0);

  return {
    ...dashboardData,
    setpointComparison,
    stateDistribution,
    numericIndicators: {
      avgTemp: dashboardData.statistics.avgTemp,
      avgError: Number(avgError.toFixed(1)),
      maxDeviation: Number(maxDeviation.toFixed(1)),
      energyConsumption: Number(energyConsumption.toFixed(1)),
    },
  };
};
