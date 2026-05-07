import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../api/client';
import type { ReportType } from '../api/types';
import { ErrorState, LoadingState } from '../components/Status';
import { StanceBadge } from '../components/StanceBadge';

const reportTypes: Array<'ALL' | ReportType> = ['ALL', 'SPAM', 'HARASSMENT', 'OFFTOPIC'];

export function AdminReviewPage() {
  const [reportType, setReportType] = useState<(typeof reportTypes)[number]>('ALL');
  const queryClient = useQueryClient();
  const params = useMemo(() => {
    const next = new URLSearchParams({ page: '0', size: '20' });
    if (reportType !== 'ALL') next.set('reportType', reportType);
    return next;
  }, [reportType]);

  const reports = useQuery({ queryKey: ['admin-reports', params.toString()], queryFn: () => api.reportedOpinions(params) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
  const fold = useMutation({ mutationFn: api.foldOpinion, onSuccess: refresh });
  const unfold = useMutation({ mutationFn: api.unfoldOpinion, onSuccess: refresh });
  const ban = useMutation({ mutationFn: api.banUser, onSuccess: refresh });

  return (
    <section className="admin-page">
      <div className="admin-header">
        <ShieldAlert size={24} />
        <div>
          <h1>Reported opinions</h1>
          <p>Scoring internals and report scores are visible only to admins.</p>
        </div>
      </div>
      <div className="segmented">
        {reportTypes.map((item) => (
          <button key={item} className={reportType === item ? 'active' : ''} onClick={() => setReportType(item)} type="button">
            {item}
          </button>
        ))}
      </div>
      {reports.isLoading && <LoadingState label="Loading reports" />}
      {reports.isError && <ErrorState error={reports.error} />}
      <div className="admin-list">
        {reports.data?.records.map((opinion) => (
          <article className="admin-card" key={opinion.id}>
            <div className="opinion-meta">
              <StanceBadge stance={opinion.stance} />
              <span>{opinion.author}</span>
              <span>{opinion.topicTitle}</span>
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
              <button type="button" onClick={() => fold.mutate(opinion.id)}>
                Fold
              </button>
              <button type="button" onClick={() => unfold.mutate(opinion.id)}>
                Unfold
              </button>
              <button type="button" onClick={() => ban.mutate(opinion.authorId)}>
                Ban user
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
