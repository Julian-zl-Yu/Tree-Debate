import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const navigate = useNavigate();
  const { setToken } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: () => api.login({ username, password }),
    onSuccess: ({ token }) => {
      setToken(token);
      navigate('/');
    }
  });

  return (
    <section className="form-page auth-page">
      <h1>Login</h1>
      <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" />
      <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
      {login.isError && <p className="form-error">{login.error.message}</p>}
      <button disabled={!username || !password || login.isPending} onClick={() => login.mutate()} type="button">
        Login
      </button>
      <Link to="/register">Create an account</Link>
    </section>
  );
}
