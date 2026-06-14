import { ReactNode } from 'react';
import { useAuth } from './auth';
import styles from './requireRole.module.scss';

type UserRole = 'admin' | 'user';

type RequireRoleProps = {
  role: UserRole;
  children: ReactNode;
  fallback?: ReactNode;
};

const roleLabel: Record<UserRole, string> = {
  admin: 'admin',
  user: 'user',
};

export const RequireRole = ({ role, children, fallback }: RequireRoleProps) => {
  const { user } = useAuth();

  if (user?.role !== role) {
    return fallback ?? <div className={styles.notice}>Требуется роль {roleLabel[role]}.</div>;
  }

  return <>{children}</>;
};
