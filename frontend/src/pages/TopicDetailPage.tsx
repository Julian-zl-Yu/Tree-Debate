import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { OpinionNode, ReportType, Stance } from '../api/types';
import { OpinionTree, stances } from '../components/OpinionTree';
import { ErrorState, LoadingState } from '../components/Status';

export function TopicDetailPage() {
  const { topicId = '' } = useParams();
  const queryClient = useQueryClient();
  const [parent, setParent] = useState<OpinionNode | null>(null);
  const [stance, setStance] = useState<Stance>('AGREE');
  const [content, setContent] = useState('');

  const topic = useQuery({ queryKey: ['topic', topicId], queryFn: () => api.topic(topicId) });
  const opinions = useQuery({ queryKey: ['opinions', topicId], queryFn: () => api.opinions(topicId) });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['opinions', topicId] });

  const createOpinion = useMutation({
    mutationFn: () => api.createOpinion(topicId, { parentId: parent?.id ?? null, stance, content }),
    onSuccess: () => {
      setContent('');
      setParent(null);
      invalidate();
    }
  });

  const likeOpinion = useMutation({ mutationFn: (node: OpinionNode) => api.likeOpinion(topicId, node.id), onSuccess: invalidate });
  const reportOpinion = useMutation({
    mutationFn: ({ node, reportType }: { node: OpinionNode; reportType: ReportType }) =>
      api.reportOpinion(topicId, node.id, { reportType }),
    onSuccess: invalidate
  });

  if (topic.isLoading || opinions.isLoading) return <LoadingState label="Loading topic" />;
  if (topic.isError) return <ErrorState error={topic.error} />;
  if (opinions.isError) return <ErrorState error={opinions.error} />;

  return (
    <div className="detail-layout">
      <section className="topic-hero">
        <div className="topic-meta">
          <span>{topic.data?.category}</span>
          <span>{topic.data?.author}</span>
        </div>
        <h1>{topic.data?.title}</h1>
        <p>{topic.data?.content}</p>
      </section>

      <section className="composer">
        <h2>{parent ? `Replying to ${parent.author}` : 'Add an opinion'}</h2>
        <div className="form-row">
          <select value={stance} onChange={(event) => setStance(event.target.value as Stance)}>
            {stances.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button disabled={!content.trim() || createOpinion.isPending} onClick={() => createOpinion.mutate()} type="button">
            Submit
          </button>
          {parent && (
            <button type="button" onClick={() => setParent(null)}>
              Cancel
            </button>
          )}
        </div>
        <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write your opinion" />
      </section>

      <OpinionTree
        nodes={opinions.data ?? []}
        onReply={setParent}
        onEdit={(node) => {
          setParent(null);
          setStance(node.stance);
          setContent(node.content);
        }}
        onLike={(node) => likeOpinion.mutate(node)}
        onReport={(node, reportType) => reportOpinion.mutate({ node, reportType })}
      />
    </div>
  );
}
