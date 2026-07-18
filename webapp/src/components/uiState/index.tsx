import type { ReactNode } from 'react';
import styles from './index.module.scss';

type StateBlockProps = {
  title: string;
  message?: string;
  action?: ReactNode;
};

export const StateBlock = ({ title, message, action }: StateBlockProps) => (
  <div className={styles.state}>
    <div className={styles.stateInner}>
      <strong>{title}</strong>
      {message ? <p>{message}</p> : null}
      {action ? <div className={styles.actions}>{action}</div> : null}
    </div>
  </div>
);

export const LoadingState = ({ title = 'Загрузка данных...' }: { title?: string }) => (
  <div className={styles.state}>
    <div className={styles.stateInner}>
      <strong>{title}</strong>
      <div className={styles.skeleton} aria-hidden="true">
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonCard} />
      </div>
    </div>
  </div>
);

export const ErrorState = ({ message }: { message: string }) => (
  <StateBlock title="Не удалось загрузить данные" message={message} />
);

export const EmptyState = ({ title, message }: StateBlockProps) => <StateBlock title={title} message={message} />;

export const stateActionClassName = styles.action;
