import { Link } from 'react-router-dom';
import { getDashboard } from '../../lib/routes';
import styles from './index.module.scss';

export const NotFoundPage = () => (
  <section className={styles.page}>
    <div className={styles.panel}>
      <span className={styles.code}>404</span>
      <h1>Страница не найдена</h1>
      <p>Такого маршрута нет в панели управления. Вернитесь на Dashboard и продолжите работу с помещениями.</p>
      <Link className={styles.link} to={getDashboard()}>
        Перейти на Dashboard
      </Link>
    </div>
  </section>
);
