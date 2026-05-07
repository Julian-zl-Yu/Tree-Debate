import { LogOut, Plus, Shield, Trees } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function AppLayout() {
  const { token, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <Trees size={22} />
          <span>MapleBoard</span>
        </Link>
        <nav className="nav">
          <NavLink to="/topics/new" className="nav-link">
            <Plus size={18} />
            New Topic
          </NavLink>
          {token && (
            <NavLink to="/admin/reports" className="nav-link">
              <Shield size={18} />
              Admin
            </NavLink>
          )}
          {token ? (
            <button className="icon-text-button" onClick={logout} type="button">
              <LogOut size={18} />
              Logout
            </button>
          ) : (
            <NavLink to="/login" className="nav-link">
              Login
            </NavLink>
          )}
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
