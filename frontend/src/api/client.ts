import type {
  AdminOpinionReport,
  AdminReportedOpinion,
  AdminTopic,
  CurrentUser,
  OpinionNode,
  Page,
  ReportType,
  Stance,
  Topic,
  TopicFeedItem
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function authHeaders() {
  const token = localStorage.getItem('mapleboard.token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  for (const [key, value] of Object.entries(authHeaders())) {
    headers.set(key, value);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text || response.statusText);
  }

  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return (await response.text()) as T;
  }
  return response.json() as Promise<T>;
}

export const api = {
  register: (body: { username: string; password: string }) =>
    request<string>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { username: string; password: string }) =>
    request<{ token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request<CurrentUser>('/api/users/me'),
  feed: (params: URLSearchParams) => request<Page<TopicFeedItem>>(`/api/topics/feed?${params}`),
  topic: (id: string) => request<Topic>(`/api/topics/${id}`),
  createTopic: (body: { category: string; title: string; content: string }) =>
    request<Topic>('/api/topics', { method: 'POST', body: JSON.stringify(body) }),
  opinions: (topicId: string) => request<OpinionNode[]>(`/api/topics/${topicId}/opinions`),
  createOpinion: (topicId: string, body: { parentId?: number | null; stance: Stance; topicStance?: Stance; content: string }) =>
    request<OpinionNode>(`/api/topics/${topicId}/opinions`, { method: 'POST', body: JSON.stringify(body) }),
  updateOpinion: (topicId: string, opinionId: number, body: { stance: Stance; topicStance?: Stance; content: string }) =>
    request<OpinionNode>(`/api/topics/${topicId}/opinions/${opinionId}`, { method: 'PUT', body: JSON.stringify(body) }),
  likeOpinion: (topicId: string, opinionId: number) =>
    request<OpinionNode>(`/api/topics/${topicId}/opinions/${opinionId}/likes`, { method: 'POST' }),
  reportOpinion: (topicId: string, opinionId: number, body: { reportType: ReportType; reason?: string }) =>
    request<OpinionNode>(`/api/topics/${topicId}/opinions/${opinionId}/reports`, {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  reportedOpinions: (params: URLSearchParams) =>
    request<Page<AdminReportedOpinion>>(`/api/admin/reported-opinions?${params}`),
  adminTopics: (params: URLSearchParams) => request<Page<AdminTopic>>(`/api/admin/topics?${params}`),
  opinionReports: (opinionId: number) => request<AdminOpinionReport[]>(`/api/admin/opinions/${opinionId}/reports`),
  deleteReport: (id: number) => request<unknown>(`/api/admin/reports/${id}`, { method: 'DELETE' }),
  deleteTopic: (id: number) => request<unknown>(`/api/admin/topics/${id}`, { method: 'DELETE' }),
  foldOpinion: (id: number) => request<unknown>(`/api/admin/opinions/${id}/fold`, { method: 'POST' }),
  unfoldOpinion: (id: number) => request<unknown>(`/api/admin/opinions/${id}/unfold`, { method: 'POST' }),
  banUser: (id: number) => request<unknown>(`/api/admin/users/${id}/ban`, { method: 'POST' }),
  unbanUser: (id: number) => request<unknown>(`/api/admin/users/${id}/unban`, { method: 'POST' })
};
