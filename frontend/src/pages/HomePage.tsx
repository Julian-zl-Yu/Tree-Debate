import { useQuery } from '@tanstack/react-query';
import { Filter, MessageCircle, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { ErrorState, LoadingState } from '../components/Status';
import { excerpt, formatDateTime, pluralize } from '../utils/format';

const sorts = ['HOT', 'NEW', 'CONTROVERSIAL'] as const;
const categories = ['ALL', 'GENERAL', 'POLICY', 'TECH', 'LOCAL', 'CULTURE'] as const;

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

  return (
    <div className="page-grid">
      <section className="feed-panel">
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
                {item}
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
          <Link to={`/topics/${topic.id}`} className="topic-card" key={topic.id}>
            <div className="topic-score-rail">
              <MessageCircle size={18} />
              <strong>{topic.replyCount}</strong>
              <span>replies</span>
            </div>
            <div>
              <div className="topic-meta">
                <strong>{topic.category}</strong>
                <span>u/{topic.author}</span>
                <span>{formatDateTime(topic.createdAt)}</span>
              </div>
              <h2>{topic.title}</h2>
              <p>{excerpt(topic.content)}</p>
              <div className="topic-footer">
                <span>{pluralize(topic.opinionCount, 'opinion')}</span>
                <span>{pluralize(topic.replyCount, 'reply', 'replies')}</span>
              </div>
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
