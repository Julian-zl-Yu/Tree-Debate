import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function RegisterPage() {
  const navigate = useNavigate();
  const { setToken } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const register = useMutation({
    mutationFn: async () => {
      await api.register({ username, password });
      return api.login({ username, password });
    },
    onSuccess: ({ token }) => {
      setToken(token);
      navigate('/');
    }
  });
  const passwordsMatch = password === confirmPassword;

  return (
    <form
      className="form-page auth-page"
      onSubmit={(event) => {
        event.preventDefault();
        if (username.length >= 3 && password.length >= 6 && passwordsMatch) register.mutate();
      }}
    >
      <h1>Register</h1>
      <label>
        Username
        <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
      </label>
      <label>
        Password
        <input value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" type="password" />
      </label>
      <label>
        Confirm password
        <input
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          type="password"
        />
      </label>
      {!passwordsMatch && confirmPassword && <p className="form-error">Passwords do not match.</p>}
      {register.isError && <p className="form-error">{register.error.message}</p>}
      <button disabled={username.length < 3 || password.length < 6 || !passwordsMatch || register.isPending} type="submit">
        {register.isPending ? 'Creating account' : 'Register'}
      </button>
      <Link to="/login">Already have an account</Link>
    </form>
  );
}
