import { NavLink, Outlet } from 'react-router-dom';
import { getDashboard, getSettings, getStatistics } from '../../lib/routes';
import css from './index.module.scss';

export const Layout = () => {
  return (
    <div className={css.layout}>
      <aside className={css.navigation}>
        <div className={css.logo}>ClimateController</div>
        <nav className={css.menu} aria-label="Главная навигация">
          <NavLink
            to={getDashboard()}
            className={({ isActive }) => `${css.link} ${isActive ? css.active : ''}`}
          >
            Dashboard
          </NavLink>
          <NavLink
            to={getStatistics()}
            className={({ isActive }) => `${css.link} ${isActive ? css.active : ''}`}
          >
            Statistics
          </NavLink>
          <NavLink
            to={getSettings()}
            className={({ isActive }) => `${css.link} ${isActive ? css.active : ''}`}
          >
            Settings
          </NavLink>
        </nav>
      </aside>
      <main className={css.content}>
        <Outlet />
      </main>
    </div>
  );
};
