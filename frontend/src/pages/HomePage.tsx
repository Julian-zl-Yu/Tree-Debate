import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { ErrorState, LoadingState } from '../components/Status';

const sorts = ['HOT', 'NEW', 'CONTROVERSIAL'] as const;

export function HomePage() {
  const [sort, setSort] = useState<(typeof sorts)[number]>('HOT');
  const [keyword, setKeyword] = useState('');
  const params = useMemo(() => {
    const next = new URLSearchParams({ sort, page: '0', size: '20' });
    if (keyword.trim()) next.set('keyword', keyword.trim());
    return next;
  }, [sort, keyword]);

  const feed = useQuery({
    queryKey: ['feed', params.toString()],
    queryFn: () => api.feed(params)
  });

  return (
    <div className="page-grid">
      <section className="feed-panel">
        <div className="feed-toolbar">
          <div className="segmented">
            {sorts.map((item) => (
              <button key={item} className={sort === item ? 'active' : ''} onClick={() => setSort(item)} type="button">
                {item}
              </button>
            ))}
          </div>
          <label className="search-box">
            <Search size={18} />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Search topics" />
          </label>
        </div>
        {feed.isLoading && <LoadingState label="Loading feed" />}
        {feed.isError && <ErrorState error={feed.error} />}
        {feed.data?.records.map((topic) => (
          <Link to={`/topics/${topic.id}`} className="topic-card" key={topic.id}>
            <div className="topic-score-rail">
              <MessageCircle size={18} />
              <strong>{topic.replyCount}</strong>
            </div>
            <div>
              <div className="topic-meta">
                <span>{topic.category}</span>
                <span>{topic.author}</span>
                <span>{new Date(topic.createdAt).toLocaleDateString()}</span>
              </div>
              <h2>{topic.title}</h2>
              <p>{topic.content}</p>
              <div className="topic-footer">
                <span>{topic.opinionCount} opinions</span>
                <span>{topic.replyCount} replies</span>
              </div>
            </div>
          </Link>
        ))}
      </section>
      <aside className="sidebar">
        <h3>TreeDebate</h3>
        <p>Discussions are ranked by debate structure. Detailed scoring is visible to moderators only.</p>
      </aside>
    </div>
  );
}
