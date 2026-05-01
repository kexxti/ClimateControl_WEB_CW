import { TrpcProvider } from './lib/trpc';
import { DashboardPage } from './pages/DashboardPage';

export const App = () => {
  return (
    <TrpcProvider>
      <DashboardPage />
    </TrpcProvider>
  );
};
