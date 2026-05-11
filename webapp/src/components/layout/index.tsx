import { Link, Outlet } from  'react-router-dom'
import { getDashboard } from '../../lib/routes'
import css from './index.module.scss'

export const Layout = () => {
    return (
        <div className={css.layout}>
            <p>
                <b className={css.logo}>ClimateController</b>
            </p>
            <ul>
                <li>
                    <Link to={getDashboard()}>Dashboard</Link>
                </li>
            </ul>
            <hr />
            <div>
                <Outlet />
            </div>
        </div>
    )
}