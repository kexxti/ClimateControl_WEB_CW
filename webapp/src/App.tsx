import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { ProtectedRoute } from './lib/ProtectedRoute';
import { ToastProvider } from './lib/toast';
import { TrpcProvider } from './lib/trpc';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { LogsPage } from './pages/LogsPage';
import { RoomPage } from './pages/RoomPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatisticsPage } from './pages/Statistics';
import { getDashboard, getLogin, getLogs, getRoom, getRoomParams, getSettings, getStatistics } from './lib/routes';
import { Layout } from './components/layout';

export const App = () => {
  return (
    <TrpcProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route index element={<Navigate to={getDashboard()} replace />} />
                  <Route path={getDashboard()} element={<DashboardPage />} />
                  <Route path={getStatistics()} element={<StatisticsPage />} />
                  <Route path={getLogs()} element={<LogsPage />} />
                  <Route path={getSettings()} element={<SettingsPage />} />
                  <Route path={getRoom(getRoomParams)} element={<RoomPage />} />
                </Route>
              </Route>
              <Route path={getLogin()} element={<LoginPage />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </TrpcProvider>
  );
};
