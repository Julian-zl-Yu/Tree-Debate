import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setToken } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const params = new URLSearchParams(location.search);
  const nextPath = params.get('next') || '/';

  const login = useMutation({
    mutationFn: () => api.login({ username, password }),
    onSuccess: ({ token }) => {
      setToken(token);
      navigate(nextPath, { replace: true });
    }
  });

  return (
    <form
      className="form-page auth-page"
      onSubmit={(event) => {
        event.preventDefault();
        if (username && password) login.mutate();
      }}
    >
      <h1>Login</h1>
      <label>
        Username
        <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
      </label>
      <label>
        Password
        <input value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" type="password" />
      </label>
      {login.isError && <p className="form-error">{login.error.message}</p>}
      <button disabled={!username || !password || login.isPending} type="submit">
        {login.isPending ? 'Logging in' : 'Login'}
      </button>
      <Link to="/register">Create an account</Link>
    </form>
  );
}
