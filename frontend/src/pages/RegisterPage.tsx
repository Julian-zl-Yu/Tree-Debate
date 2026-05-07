import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const register = useMutation({
    mutationFn: () => api.register({ username, password }),
    onSuccess: () => navigate('/login')
  });

  return (
    <section className="form-page auth-page">
      <h1>Register</h1>
      <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" />
      <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
      {register.isError && <p className="form-error">{register.error.message}</p>}
      <button disabled={username.length < 3 || password.length < 6 || register.isPending} onClick={() => register.mutate()} type="button">
        Register
      </button>
      <Link to="/login">Already have an account</Link>
    </section>
  );
}
