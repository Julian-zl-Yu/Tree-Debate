import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export function CreateTopicPage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('GENERAL');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const createTopic = useMutation({
    mutationFn: () => api.createTopic({ category, title, content }),
    onSuccess: (topic) => navigate(`/topics/${topic.id}`)
  });

  return (
    <section className="form-page">
      <h1>New topic</h1>
      <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Category" />
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
      <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="What should people debate?" />
      {createTopic.isError && <p className="form-error">{createTopic.error.message}</p>}
      <button disabled={!title.trim() || !content.trim() || createTopic.isPending} onClick={() => createTopic.mutate()} type="button">
        Create topic
      </button>
    </section>
  );
}
