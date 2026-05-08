import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, UserX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../api/client';
import type { ReportType } from '../api/types';
import { ErrorState, LoadingState } from '../components/Status';
import { StanceBadge } from '../components/StanceBadge';
import { formatDateTime } from '../utils/format';

const reportTypes: Array<'ALL' | ReportType> = ['ALL', 'SPAM', 'HARASSMENT', 'OFFTOPIC'];
const foldedFilters = ['ALL', 'OPEN', 'FOLDED'] as const;

export function AdminReviewPage() {
  const [reportType, setReportType] = useState<(typeof reportTypes)[number]>('ALL');
  const [foldedFilter, setFoldedFilter] = useState<(typeof foldedFilters)[number]>('ALL');
  const [page, setPage] = useState(0);
  const [userId, setUserId] = useState('');
  const queryClient = useQueryClient();
  const params = useMemo(() => {
    const next = new URLSearchParams({ page: String(page), size: '20' });
    if (reportType !== 'ALL') next.set('reportType', reportType);
    if (foldedFilter === 'OPEN') next.set('folded', 'false');
    if (foldedFilter === 'FOLDED') next.set('folded', 'true');
    return next;
  }, [reportType, foldedFilter, page]);

  const reports = useQuery({ queryKey: ['admin-reports', params.toString()], queryFn: () => api.reportedOpinions(params) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
  const fold = useMutation({ mutationFn: api.foldOpinion, onSuccess: refresh });
  const unfold = useMutation({ mutationFn: api.unfoldOpinion, onSuccess: refresh });
  const ban = useMutation({ mutationFn: api.banUser, onSuccess: refresh });
  const unban = useMutation({ mutationFn: api.unbanUser, onSuccess: refresh });
  const totalPages = reports.data?.pages ?? Math.max(1, Math.ceil((reports.data?.total ?? 0) / (reports.data?.size ?? 20)));
  const parsedUserId = Number(userId);
  const hasValidUserId = Number.isInteger(parsedUserId) && parsedUserId > 0;

  return (
    <section className="admin-page">
      <div className="admin-header">
        <ShieldAlert size={24} />
        <div>
          <h1>Reported opinions</h1>
          <p>Scoring internals and report scores are visible only to admins.</p>
        </div>
      </div>
      <div className="admin-filters">
        <div className="segmented">
          {reportTypes.map((item) => (
            <button
              key={item}
              className={reportType === item ? 'active' : ''}
              onClick={() => {
                setReportType(item);
                setPage(0);
              }}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <div className="segmented">
          {foldedFilters.map((item) => (
            <button
              key={item}
              className={foldedFilter === item ? 'active' : ''}
              onClick={() => {
                setFoldedFilter(item);
                setPage(0);
              }}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="admin-user-tools">
        <UserX size={18} />
        <input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="User ID" inputMode="numeric" />
        <button disabled={!hasValidUserId || ban.isPending} onClick={() => ban.mutate(parsedUserId)} type="button">
          Ban
        </button>
        <button disabled={!hasValidUserId || unban.isPending} onClick={() => unban.mutate(parsedUserId)} type="button">
          Unban
        </button>
      </div>
      {reports.isLoading && <LoadingState label="Loading reports" />}
      {reports.isError && <ErrorState error={reports.error} />}
      {!reports.isLoading && !reports.isError && reports.data?.records.length === 0 && (
        <div className="empty-state">
          <h2>No reported opinions match this filter</h2>
        </div>
      )}
      <div className="admin-list">
        {reports.data?.records.map((opinion) => (
          <article className="admin-card" key={opinion.id}>
            <div className="opinion-meta">
              <StanceBadge stance={opinion.stance} />
              <span>u/{opinion.author}</span>
              <span>{opinion.topicTitle}</span>
              <span>{formatDateTime(opinion.createdAt)}</span>
              {opinion.folded && <span className="folded-label">Folded</span>}
            </div>
            <p>{opinion.content}</p>
            <div className="score-grid">
              <span>Spam {opinion.reportScoreSpam}</span>
              <span>Harassment {opinion.reportScoreHarassment}</span>
              <span>Off-topic {opinion.reportScoreOfftopic}</span>
              <span>Entropy {opinion.opinionEntropy?.toFixed(3)}</span>
              <span>Final {opinion.finalScore?.toFixed(3)}</span>
            </div>
            <div className="opinion-actions">
              <button disabled={opinion.folded || fold.isPending} type="button" onClick={() => fold.mutate(opinion.id)}>
                Fold
              </button>
              <button disabled={!opinion.folded || unfold.isPending} type="button" onClick={() => unfold.mutate(opinion.id)}>
                Unfold
              </button>
              <button disabled={ban.isPending} type="button" onClick={() => ban.mutate(opinion.authorId)}>
                Ban user
              </button>
            </div>
          </article>
        ))}
      </div>
      {reports.data && reports.data.records.length > 0 && (
        <div className="pager">
          <button disabled={page === 0 || reports.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} type="button">
            Previous
          </button>
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <button
            disabled={page + 1 >= totalPages || reports.isFetching}
            onClick={() => setPage((value) => value + 1)}
            type="button"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
