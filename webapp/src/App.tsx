import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { TrpcProvider } from './lib/trpc';
import { DashboardPage } from './pages/DashboardPage';
import { RoomPage } from './pages/RoomPage';
import { getDashboard, getRoom, getRoomParams } from './lib/routes';
import { Layout } from './components/layout';

export const App = () => {
  return (
    <TrpcProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}> 
            <Route path={getDashboard()} element={<DashboardPage/>}/>
            <Route path={getRoom(getRoomParams)} element={<RoomPage/>}/>
          </Route>
        </Routes>
      </BrowserRouter>
   
    </TrpcProvider>
  );
};
