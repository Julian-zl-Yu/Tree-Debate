import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const categories = ['GENERAL', 'POLICY', 'TECH', 'LOCAL', 'CULTURE'] as const;

export function CreateTopicPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [category, setCategory] = useState<(typeof categories)[number]>('GENERAL');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const createTopic = useMutation({
    mutationFn: () => api.createTopic({ category, title, content }),
    onSuccess: (topic) => navigate(`/topics/${topic.id}`),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        navigate('/login?next=/topics/new');
      }
    }
  });
  const titleRemaining = 150 - title.length;
  const canSubmit = Boolean(token) && title.trim().length > 0 && title.length <= 150 && content.trim().length > 0;

  if (!token) {
    return (
      <section className="form-page auth-page">
        <h1>Login required</h1>
        <Link to="/login?next=/topics/new" className="primary-link">
          Login to create a topic
        </Link>
      </section>
    );
  }

  return (
    <form
      className="form-page topic-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) createTopic.mutate();
      }}
    >
      <h1>New topic</h1>
      <label>
        Category
        <select value={category} onChange={(event) => setCategory(event.target.value as (typeof categories)[number])}>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        Title
        <input value={title} maxLength={150} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <span className={titleRemaining < 0 ? 'form-error' : 'form-hint'}>{titleRemaining} characters left</span>
      <label>
        Content
        <textarea value={content} onChange={(event) => setContent(event.target.value)} />
      </label>
      {createTopic.isError && <p className="form-error">{createTopic.error.message}</p>}
      <button disabled={!canSubmit || createTopic.isPending} type="submit">
        {createTopic.isPending ? 'Creating topic' : 'Create topic'}
      </button>
    </form>
  );
}
