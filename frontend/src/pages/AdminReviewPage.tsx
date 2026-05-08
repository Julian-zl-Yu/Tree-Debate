import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, Trash2, UserX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { ReportType } from '../api/types';
import { ErrorState, LoadingState } from '../components/Status';
import { StanceBadge } from '../components/StanceBadge';
import { formatDateTime } from '../utils/format';

const reportTypes: Array<'ALL' | ReportType> = ['ALL', 'SPAM', 'HARASSMENT', 'OFFTOPIC'];
const foldedFilters = ['ALL', 'OPEN', 'FOLDED'] as const;
const adminModules = ['REPORTS', 'TOPICS'] as const;
const topicSorts = ['HOT', 'NEW', 'CONTROVERSIAL'] as const;
const categories = ['ALL', 'GENERAL', 'POLICY', 'TECH', 'LOCAL', 'CULTURE'] as const;
const dayMs = 24 * 60 * 60 * 1000;

function formatMetric(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value).toFixed(3) : '0.000';
}

function daysPosted(createdAt: string) {
  const createdTime = new Date(createdAt).getTime();
  if (!Number.isFinite(createdTime)) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - createdTime) / dayMs));
}

export function AdminReviewPage() {
  const [module, setModule] = useState<(typeof adminModules)[number]>('REPORTS');

  return (
    <section className="admin-page">
      <div className="admin-header">
        <ShieldAlert size={24} />
        <div>
          <h1>Admin</h1>
          <p>Scoring internals, report scores, and moderation controls are visible only to admins.</p>
        </div>
      </div>
      <div className="segmented admin-module-tabs">
        {adminModules.map((item) => (
          <button key={item} className={module === item ? 'active' : ''} onClick={() => setModule(item)} type="button">
            {item === 'REPORTS' ? 'Reported opinions' : 'Topics'}
          </button>
        ))}
      </div>
      {module === 'REPORTS' ? <ReportedOpinionsModule /> : <AdminTopicsModule />}
    </section>
  );
}

function ReportedOpinionsModule() {
  const [reportType, setReportType] = useState<(typeof reportTypes)[number]>('ALL');
  const [foldedFilter, setFoldedFilter] = useState<(typeof foldedFilters)[number]>('ALL');
  const [page, setPage] = useState(0);
  const [userId, setUserId] = useState('');
  const [expandedOpinionId, setExpandedOpinionId] = useState<number | null>(null);
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
    <>
      <div className="admin-submodule-header">
        <h2>Reported opinions</h2>
        <p>Review reported opinion nodes, inspect individual reports, and fold or unfold content.</p>
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
              <span>topic {opinion.effectiveTopicStance}</span>
              <span>u/{opinion.author}</span>
              <span>{opinion.topicTitle}</span>
              <span>{formatDateTime(opinion.createdAt)}</span>
              {opinion.folded && <span className="folded-label">Folded</span>}
            </div>
            <p>{opinion.content}</p>
            <AdminScoreGrid
              finalScore={opinion.finalScore}
              opinionEntropy={opinion.opinionEntropy}
              engagementWeight={opinion.engagementWeight}
              freshnessFactor={opinion.freshnessFactor}
              createdAt={opinion.createdAt}
            />
            <div className="score-grid report-score-grid">
              <span>spam_score {formatMetric(opinion.reportScoreSpam)}</span>
              <span>harassment_score {formatMetric(opinion.reportScoreHarassment)}</span>
              <span>offtopic_score {formatMetric(opinion.reportScoreOfftopic)}</span>
              <span>comment_weight {formatMetric(opinion.commentWeight)}</span>
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
              <button type="button" onClick={() => setExpandedOpinionId((value) => (value === opinion.id ? null : opinion.id))}>
                {expandedOpinionId === opinion.id ? 'Hide reports' : 'View reports'}
              </button>
            </div>
            {expandedOpinionId === opinion.id && <ReportDetails opinionId={opinion.id} />}
          </article>
        ))}
      </div>
      {reports.data && reports.data.records.length > 0 && (
        <Pager page={page} totalPages={totalPages} isFetching={reports.isFetching} onPageChange={setPage} />
      )}
    </>
  );
}

function AdminTopicsModule() {
  const [sort, setSort] = useState<(typeof topicSorts)[number]>('HOT');
  const [category, setCategory] = useState<(typeof categories)[number]>('ALL');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();
  const params = useMemo(() => {
    const next = new URLSearchParams({ sort, page: String(page), size: '20' });
    if (category !== 'ALL') next.set('category', category);
    if (keyword.trim()) next.set('keyword', keyword.trim());
    return next;
  }, [sort, category, keyword, page]);
  const topics = useQuery({ queryKey: ['admin-topics', params.toString()], queryFn: () => api.adminTopics(params) });
  const deleteTopic = useMutation({
    mutationFn: api.deleteTopic,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-topics'] })
  });
  const totalPages = topics.data?.pages ?? Math.max(1, Math.ceil((topics.data?.total ?? 0) / (topics.data?.size ?? 20)));

  return (
    <>
      <div className="admin-submodule-header">
        <h2>Topics</h2>
        <p>Review topic-level scoring data and remove topics when needed.</p>
      </div>
      <div className="admin-filters">
        <div className="segmented">
          {topicSorts.map((item) => (
            <button
              key={item}
              className={sort === item ? 'active' : ''}
              onClick={() => {
                setSort(item);
                setPage(0);
              }}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <div className="segmented">
          {categories.map((item) => (
            <button
              key={item}
              className={category === item ? 'active' : ''}
              onClick={() => {
                setCategory(item);
                setPage(0);
              }}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <label className="search-box admin-search-box">
          <input
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(0);
            }}
            placeholder="Search topics"
          />
        </label>
      </div>
      {topics.isLoading && <LoadingState label="Loading topics" />}
      {topics.isError && <ErrorState error={topics.error} />}
      {!topics.isLoading && !topics.isError && topics.data?.records.length === 0 && (
        <div className="empty-state">
          <h2>No topics match this filter</h2>
        </div>
      )}
      <div className="admin-list">
        {topics.data?.records.map((topic) => (
          <article className="admin-card" key={topic.id}>
            <div className="topic-meta">
              <strong>{topic.category}</strong>
              <span>topic #{topic.id}</span>
              <span>u/{topic.author}</span>
              <span>{formatDateTime(topic.createdAt)}</span>
            </div>
            <h2>{topic.title}</h2>
            <p>{topic.content}</p>
            <AdminScoreGrid
              finalScore={topic.finalScore}
              opinionEntropy={topic.opinionEntropy}
              engagementWeight={topic.engagementWeight}
              freshnessFactor={topic.freshnessFactor}
              createdAt={topic.createdAt}
            />
            <div className="score-grid report-score-grid">
              <span>opinions {topic.opinionCount}</span>
              <span>replies {topic.replyCount}</span>
              <span>reported opinions {topic.reportedOpinionCount}</span>
              <span>folded opinions {topic.foldedOpinionCount}</span>
            </div>
            <div className="opinion-actions">
              <Link to={`/topics/${topic.id}`} className="nav-link">
                View topic
              </Link>
              <button
                disabled={deleteTopic.isPending}
                onClick={() => {
                  if (window.confirm(`Delete topic #${topic.id}? This also removes its opinion tree.`)) {
                    deleteTopic.mutate(topic.id);
                  }
                }}
                type="button"
              >
                <Trash2 size={16} />
                Delete topic
              </button>
            </div>
          </article>
        ))}
      </div>
      {topics.data && topics.data.records.length > 0 && (
        <Pager page={page} totalPages={totalPages} isFetching={topics.isFetching} onPageChange={setPage} />
      )}
    </>
  );
}

function AdminScoreGrid(props: {
  finalScore: number;
  opinionEntropy: number;
  engagementWeight: number;
  freshnessFactor: number;
  createdAt: string;
}) {
  return (
    <div className="score-grid score-grid-primary">
      <span>
        <strong>final_score</strong>
        <b>{formatMetric(props.finalScore)}</b>
      </span>
      <span>
        <strong>opinion_entropy</strong>
        <b>{formatMetric(props.opinionEntropy)}</b>
      </span>
      <span>
        <strong>engagement_weight</strong>
        <b>{formatMetric(props.engagementWeight)}</b>
      </span>
      <span>
        <strong>freshness_factor</strong>
        <b>{formatMetric(props.freshnessFactor)}</b>
      </span>
      <span>
        <strong>days posted</strong>
        <b>{daysPosted(props.createdAt)}</b>
      </span>
    </div>
  );
}

function Pager(props: { page: number; totalPages: number; isFetching: boolean; onPageChange: (page: number) => void }) {
  return (
    <div className="pager">
      <button
        disabled={props.page === 0 || props.isFetching}
        onClick={() => props.onPageChange(Math.max(0, props.page - 1))}
        type="button"
      >
        Previous
      </button>
      <span>
        Page {props.page + 1} of {props.totalPages}
      </span>
      <button
        disabled={props.page + 1 >= props.totalPages || props.isFetching}
        onClick={() => props.onPageChange(props.page + 1)}
        type="button"
      >
        Next
      </button>
    </div>
  );
}

function ReportDetails({ opinionId }: { opinionId: number }) {
  const queryClient = useQueryClient();
  const reports = useQuery({
    queryKey: ['admin-opinion-reports', opinionId],
    queryFn: () => api.opinionReports(opinionId)
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-opinion-reports', opinionId] });
    queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
  };
  const deleteReport = useMutation({ mutationFn: api.deleteReport, onSuccess: refresh });

  if (reports.isLoading) {
    return <p className="form-hint">Loading report details...</p>;
  }
  if (reports.isError) {
    return <ErrorState error={reports.error} />;
  }
  if (!reports.data?.length) {
    return <p className="form-hint">No individual reports remain for this opinion.</p>;
  }

  return (
    <div className="report-detail-list">
      {reports.data.map((report) => (
        <div className="report-detail-row" key={report.id}>
          <div>
            <strong>{report.reportType}</strong>
            <span>
              {' '}
              by u/{report.reporter} - weight {report.weight} - {formatDateTime(report.createdAt)}
            </span>
            {report.reason && <p>{report.reason}</p>}
          </div>
          <button disabled={deleteReport.isPending} onClick={() => deleteReport.mutate(report.id)} type="button">
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
