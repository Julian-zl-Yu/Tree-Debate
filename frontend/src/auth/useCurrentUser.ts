import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

export function useCurrentUser() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['me', token],
    queryFn: api.me,
    enabled: Boolean(token),
    retry: false
  });
}
