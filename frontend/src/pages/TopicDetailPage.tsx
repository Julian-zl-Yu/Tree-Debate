import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import type { OpinionNode, ReportType, Stance } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useCurrentUser } from '../auth/useCurrentUser';
import { OpinionTree, stances } from '../components/OpinionTree';
import { ErrorState, LoadingState } from '../components/Status';
import { formatDateTime } from '../utils/format';

type ComposerState =
  | { mode: 'new' }
  | { mode: 'reply'; parent: OpinionNode }
  | { mode: 'edit'; node: OpinionNode };

const reportTypes: ReportType[] = ['SPAM', 'HARASSMENT', 'OFFTOPIC'];

export function TopicDetailPage() {
  const { topicId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();
  const [composer, setComposer] = useState<ComposerState>({ mode: 'new' });
  const [stance, setStance] = useState<Stance>('AGREE');
  const [content, setContent] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<OpinionNode | null>(null);
  const [reportType, setReportType] = useState<ReportType>('SPAM');
  const [reportReason, setReportReason] = useState('');

  const topic = useQuery({ queryKey: ['topic', topicId], queryFn: () => api.topic(topicId) });
  const opinions = useQuery({ queryKey: ['opinions', topicId], queryFn: () => api.opinions(topicId) });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['opinions', topicId] });
  const loginForAction = () => navigate(`/login?next=${encodeURIComponent(location.pathname)}`);

  const saveOpinion = useMutation({
    mutationFn: () => {
      if (composer.mode === 'edit') {
        return api.updateOpinion(topicId, composer.node.id, { stance, content });
      }
      return api.createOpinion(topicId, {
        parentId: composer.mode === 'reply' ? composer.parent.id : null,
        stance,
        content
      });
    },
    onSuccess: () => {
      setContent('');
      setComposer({ mode: 'new' });
      setMessage(null);
      invalidate();
    },
    onError: (error) => handleActionError(error)
  });

  const likeOpinion = useMutation({
    mutationFn: (node: OpinionNode) => api.likeOpinion(topicId, node.id),
    onSuccess: invalidate,
    onError: (error) => handleActionError(error)
  });

  const reportOpinion = useMutation({
    mutationFn: () => {
      if (!reportTarget) throw new Error('No opinion selected');
      return api.reportOpinion(topicId, reportTarget.id, {
        reportType,
        reason: reportReason.trim() || undefined
      });
    },
    onSuccess: () => {
      setReportTarget(null);
      setReportReason('');
      setReportType('SPAM');
      setMessage('Report submitted.');
      invalidate();
    },
    onError: (error) => handleActionError(error)
  });

  function handleActionError(error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      loginForAction();
      return;
    }
    setMessage(error instanceof Error ? error.message : 'Action failed.');
  }

  function startReply(node: OpinionNode) {
    if (!token) {
      loginForAction();
      return;
    }
    setMessage(null);
    setComposer({ mode: 'reply', parent: node });
    setStance('AGREE');
    setContent('');
  }

  function startEdit(node: OpinionNode) {
    if (!token) {
      loginForAction();
      return;
    }
    if (currentUser.data?.id !== node.authorId) {
      setMessage('You can only edit your own opinion.');
      return;
    }
    setMessage(null);
    setComposer({ mode: 'edit', node });
    setStance(node.stance);
    setContent(node.content);
  }

  function startReport(node: OpinionNode) {
    if (!token) {
      loginForAction();
      return;
    }
    setReportTarget(node);
    setReportReason('');
    setReportType('SPAM');
  }

  const composerTitle =
    composer.mode === 'edit'
      ? 'Edit your opinion'
      : composer.mode === 'reply'
        ? `Replying to ${composer.parent.author}`
        : 'Add an opinion';

  if (topic.isLoading || opinions.isLoading) return <LoadingState label="Loading topic" />;
  if (topic.isError) return <ErrorState error={topic.error} />;
  if (opinions.isError) return <ErrorState error={opinions.error} />;

  return (
    <div className="detail-layout">
      <section className="topic-hero">
        <div className="topic-meta">
          <span>{topic.data?.category}</span>
          <span>u/{topic.data?.author}</span>
          {topic.data?.createdAt && <span>{formatDateTime(topic.data.createdAt)}</span>}
        </div>
        <h1>{topic.data?.title}</h1>
        <p>{topic.data?.content}</p>
      </section>

      <section className="composer">
        <h2>{composerTitle}</h2>
        {message && <p className="form-error">{message}</p>}
        {!token && (
          <p className="form-hint">
            <Link to={`/login?next=${encodeURIComponent(location.pathname)}`}>Login</Link> to add opinions, like, or report.
          </p>
        )}
        <div className="form-row">
          <select value={stance} onChange={(event) => setStance(event.target.value as Stance)}>
            {stances.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button disabled={!token || !content.trim() || saveOpinion.isPending} onClick={() => saveOpinion.mutate()} type="button">
            {saveOpinion.isPending ? 'Saving' : composer.mode === 'edit' ? 'Save' : 'Submit'}
          </button>
          {composer.mode !== 'new' && (
            <button
              type="button"
              onClick={() => {
                setComposer({ mode: 'new' });
                setContent('');
                setMessage(null);
              }}
            >
              Cancel
            </button>
          )}
        </div>
        <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write your opinion" />
      </section>

      {reportTarget && (
        <section className="report-panel">
          <h2>Report opinion by {reportTarget.author}</h2>
          <div className="form-row">
            <select value={reportType} onChange={(event) => setReportType(event.target.value as ReportType)}>
              {reportTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button disabled={reportOpinion.isPending} onClick={() => reportOpinion.mutate()} type="button">
              {reportOpinion.isPending ? 'Submitting' : 'Submit report'}
            </button>
            <button type="button" onClick={() => setReportTarget(null)}>
              Cancel
            </button>
          </div>
          <textarea value={reportReason} onChange={(event) => setReportReason(event.target.value)} placeholder="Optional reason" />
        </section>
      )}

      <OpinionTree
        nodes={opinions.data ?? []}
        currentUserId={currentUser.data?.id}
        onReply={startReply}
        onEdit={startEdit}
        onLike={(node) => {
          if (!token) loginForAction();
          else likeOpinion.mutate(node);
        }}
        onReport={startReport}
      />
    </div>
  );
}
