import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TrpcProvider } from './lib/trpc';
import { DashboardPage } from './pages/DashboardPage';
import { RoomPage } from './pages/RoomPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatisticsPage } from './pages/Statistics';
import { getDashboard, getRoom, getRoomParams, getSettings, getStatistics } from './lib/routes';
import { Layout } from './components/layout';

export const App = () => {
  return (
    <TrpcProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to={getDashboard()} replace />} />
            <Route path={getDashboard()} element={<DashboardPage />} />
            <Route path={getStatistics()} element={<StatisticsPage />} />
            <Route path={getSettings()} element={<SettingsPage />} />
            <Route path={getRoom(getRoomParams)} element={<RoomPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TrpcProvider>
  );
};
