import { useQuery } from '@tanstack/react-query';
import { Activity, Clock, Filter, Flame, GitBranch, Layers, MessageCircle, Plus, Search, TrendingUp, Users } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { TopicFeedItem } from '../api/types';
import { ErrorState, LoadingState } from '../components/Status';
import { excerpt, formatDateTime, pluralize } from '../utils/format';

const sorts = ['HOT', 'NEW', 'CONTROVERSIAL'] as const;
const categories = ['ALL', 'GENERAL', 'POLICY', 'TECH', 'LOCAL', 'CULTURE'] as const;

function activityScore(topic: TopicFeedItem) {
  return topic.opinionCount + topic.replyCount;
}

function rootOpinionCount(topic: TopicFeedItem) {
  return Math.max(0, topic.opinionCount - topic.replyCount);
}

function discussionShape(topic: TopicFeedItem) {
  const roots = rootOpinionCount(topic);
  const replies = topic.replyCount;
  const total = activityScore(topic);

  if (total === 0) {
    return { label: 'Open floor', detail: 'No opinions yet', tone: 'quiet' };
  }
  if (replies === 0) {
    return { label: 'Fresh takes', detail: `${roots} root ${roots === 1 ? 'opinion' : 'opinions'}`, tone: 'fresh' };
  }
  if (replies >= roots * 2 && replies >= 6) {
    return { label: 'Deep thread', detail: 'Replies are driving the debate', tone: 'deep' };
  }
  if (roots >= 4 && replies >= 4) {
    return { label: 'Branching', detail: 'Multiple visible branches', tone: 'branching' };
  }
  if (total >= 14) {
    return { label: 'Active debate', detail: 'Strong participation', tone: 'active' };
  }
  return { label: 'Forming', detail: 'Early discussion shape', tone: 'forming' };
}

function activityLabel(topic: TopicFeedItem) {
  const score = activityScore(topic);
  if (score >= 24) return 'Very active';
  if (score >= 14) return 'Active';
  if (score >= 6) return 'Building';
  if (score > 0) return 'Starting';
  return 'Waiting';
}

function ageLabel(value: string) {
  const created = new Date(value).getTime();
  const diffHours = Math.max(0, Math.floor((Date.now() - created) / 3_600_000));
  if (diffHours < 1) return 'just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const days = Math.floor(diffHours / 24);
  return `${days}d ago`;
}

export function HomePage() {
  const [sort, setSort] = useState<(typeof sorts)[number]>('HOT');
  const [category, setCategory] = useState<(typeof categories)[number]>('ALL');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const params = useMemo(() => {
    const next = new URLSearchParams({ sort, page: String(page), size: '20' });
    if (category !== 'ALL') next.set('category', category);
    if (keyword.trim()) next.set('keyword', keyword.trim());
    return next;
  }, [sort, category, keyword, page]);

  const feed = useQuery({
    queryKey: ['feed', params.toString()],
    queryFn: () => api.feed(params)
  });
  const records = feed.data?.records ?? [];
  const totalPages = feed.data?.pages ?? Math.max(1, Math.ceil((feed.data?.total ?? 0) / (feed.data?.size ?? 20)));
  const feedSummary = useMemo(() => {
    const opinions = records.reduce((sum, topic) => sum + topic.opinionCount, 0);
    const replies = records.reduce((sum, topic) => sum + topic.replyCount, 0);
    const mostDiscussed = [...records].sort((a, b) => activityScore(b) - activityScore(a))[0];
    const newestActive = [...records]
      .filter((topic) => activityScore(topic) > 0)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const mostBranched = [...records].sort((a, b) => {
      const aBranches = rootOpinionCount(a) + a.replyCount * 1.5;
      const bBranches = rootOpinionCount(b) + b.replyCount * 1.5;
      return bBranches - aBranches;
    })[0];
    const categoryCounts = records.reduce<Record<string, number>>((counts, topic) => {
      counts[topic.category] = (counts[topic.category] ?? 0) + 1;
      return counts;
    }, {});
    const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'None';

    return {
      topics: feed.data?.total ?? records.length,
      opinions,
      replies,
      topCategory,
      mostDiscussed,
      newestActive,
      mostBranched
    };
  }, [feed.data?.total, records]);

  return (
    <div className="page-grid">
      <section className="feed-panel">
        <div className="feed-summary">
          <div>
            <span className="eyebrow">Debate feed</span>
            <h1>Browse structured discussions</h1>
          </div>
          <div className="feed-summary-grid">
            <span>
              <strong>{feedSummary.topics}</strong>
              topics
            </span>
            <span>
              <strong>{feedSummary.opinions}</strong>
              opinions
            </span>
            <span>
              <strong>{feedSummary.replies}</strong>
              replies
            </span>
            <span>
              <strong>{feedSummary.topCategory}</strong>
              top category
            </span>
          </div>
        </div>
        <div className="feed-toolbar">
          <div className="segmented">
            {sorts.map((item) => (
              <button
                key={item}
                className={sort === item ? 'active' : ''}
                onClick={() => {
                  setSort(item);
                  setPage(0);
                }}
                type="button"
              >
                {item === 'HOT' && <Flame size={16} />}
                {item === 'NEW' && <Clock size={16} />}
                {item === 'CONTROVERSIAL' && <GitBranch size={16} />}
                <span>{item === 'HOT' ? 'Hot Debates' : item === 'NEW' ? 'New Topics' : 'Most Split'}</span>
              </button>
            ))}
          </div>
          <label className="search-box">
            <Search size={18} />
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
        <div className="category-row">
          <Filter size={16} />
          {categories.map((item) => (
            <button
              key={item}
              className={category === item ? 'category-active' : ''}
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
        {feed.isLoading && <LoadingState label="Loading feed" />}
        {feed.isError && <ErrorState error={feed.error} />}
        {!feed.isLoading && !feed.isError && records.length === 0 && (
          <div className="empty-state">
            <h2>No topics found</h2>
            <Link to="/topics/new" className="primary-link">
              <Plus size={18} />
              Start one
            </Link>
          </div>
        )}
        {records.map((topic) => (
          <Link to={`/topics/${topic.id}`} className="topic-card debate-card" key={topic.id}>
            <div className="topic-score-rail debate-rail">
              <Activity size={18} />
              <strong>{activityScore(topic)}</strong>
              <span>{activityLabel(topic)}</span>
              <div className="rail-meter" aria-hidden="true">
                <span style={{ height: `${Math.max(10, Math.min(100, activityScore(topic) * 6))}%` }} />
              </div>
            </div>
            <div className="topic-card-main">
              <div className="topic-meta">
                <strong className="category-chip">{topic.category}</strong>
                <span>u/{topic.author}</span>
                <span>{ageLabel(topic.createdAt)}</span>
              </div>
              <h2>
                <span>{topic.title}</span>
              </h2>
              <p>{excerpt(topic.content)}</p>
              <div className="structure-strip" title="Root opinions compared with replies">
                <span className="structure-root" style={{ flex: Math.max(1, rootOpinionCount(topic)) }} />
                <span className="structure-reply" style={{ flex: Math.max(1, topic.replyCount) }} />
              </div>
              <div className="topic-footer debate-footer">
                <span>
                  <Users size={15} />
                  {pluralize(topic.opinionCount, 'opinion')}
                </span>
                <span>
                  <MessageCircle size={15} />
                  {pluralize(topic.replyCount, 'reply', 'replies')}
                </span>
                <span>
                  <Layers size={15} />
                  {rootOpinionCount(topic)} root {rootOpinionCount(topic) === 1 ? 'branch' : 'branches'}
                </span>
              </div>
            </div>
            <div className="debate-status-panel">
              <span className={`debate-status debate-status-${discussionShape(topic).tone}`}>{discussionShape(topic).label}</span>
              <small>{discussionShape(topic).detail}</small>
              <span className="posted-at">{formatDateTime(topic.createdAt)}</span>
            </div>
          </Link>
        ))}
        {records.length > 0 && (
          <div className="pager">
            <button disabled={page === 0 || feed.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))} type="button">
              Previous
            </button>
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <button
              disabled={page + 1 >= totalPages || feed.isFetching}
              onClick={() => setPage((value) => value + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        )}
      </section>
      <aside className="sidebar">
        <Link to="/topics/new" className="sidebar-create">
          <Plus size={18} />
          New topic
        </Link>
        <div className="sidebar-block debate-pulse">
          <h3>Debate Pulse</h3>
          <PulseItem icon={<TrendingUp size={16} />} label="Most discussed" topic={feedSummary.mostDiscussed} />
          <PulseItem icon={<Clock size={16} />} label="Recently active" topic={feedSummary.newestActive} />
          <PulseItem icon={<GitBranch size={16} />} label="Most branched" topic={feedSummary.mostBranched} />
        </div>
        <div className="sidebar-block">
          <h3>Categories</h3>
          {categories
            .filter((item) => item !== 'ALL')
            .map((item) => (
              <button
                key={item}
                className={category === item ? 'category-active' : ''}
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
      </aside>
    </div>
  );
}

function PulseItem({ icon, label, topic }: { icon: ReactNode; label: string; topic?: TopicFeedItem }) {
  if (!topic) {
    return (
      <div className="pulse-item pulse-empty">
        {icon}
        <span>{label}</span>
        <small>No data yet</small>
      </div>
    );
  }

  return (
    <Link to={`/topics/${topic.id}`} className="pulse-item">
      {icon}
      <span>{label}</span>
      <strong>{topic.title}</strong>
      <small>{activityScore(topic)} interactions</small>
    </Link>
  );
}
