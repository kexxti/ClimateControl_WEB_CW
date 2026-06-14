import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getLogin } from './routes';
import { useAuth } from './auth';
import styles from './protectedRoute.module.scss';

export const ProtectedRoute = () => {
  const location = useLocation();
  const { isAuthenticated, isBackendUnavailable, isCheckingSession } = useAuth();

  if (isCheckingSession) {
    return <div className={styles.state}>Проверяем сессию...</div>;
  }

  if (isBackendUnavailable) {
    return (
      <div className={styles.state}>
        <div className={styles.backendError}>
          <strong>Backend недоступен</strong>
          <span>Проверьте, что backend-сервер запущен на localhost:3000.</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={getLogin()} state={{ from: location }} replace />;
  }

  return <Outlet />;
};
