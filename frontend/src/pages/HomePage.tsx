import { useInfiniteQuery } from '@tanstack/react-query';
import { Clock, Eye, EyeOff, Filter, Flame, GitBranch, Moon, Plus, Search, Sun, TrendingUp } from 'lucide-react';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { TopicFeedItem } from '../api/types';
import { TopicForestScene } from '../components/TopicForestScene';
import { ErrorState, LoadingState } from '../components/Status';

const sorts = ['HOT', 'NEW', 'CONTROVERSIAL'] as const;
const categories = ['ALL', 'GENERAL', 'POLICY', 'TECH', 'LOCAL', 'CULTURE'] as const;

function activityScore(topic: TopicFeedItem) {
  return (topic.opinionCount ?? 0) + (topic.replyCount ?? 0);
}

function rootOpinionCount(topic: TopicFeedItem) {
  return Math.max(0, (topic.opinionCount ?? 0) - (topic.replyCount ?? 0));
}

export function HomePage() {
  const [sort, setSort] = useState<(typeof sorts)[number]>('HOT');
  const [category, setCategory] = useState<(typeof categories)[number]>('ALL');
  const [keyword, setKeyword] = useState('');
  const [sceneTheme, setSceneTheme] = useState<'day' | 'night'>('day');
  const [panelsHidden, setPanelsHidden] = useState(false);
  const baseParams = useMemo(() => {
    const next = new URLSearchParams({ sort, size: '20' });
    if (category !== 'ALL') next.set('category', category);
    if (keyword.trim()) next.set('keyword', keyword.trim());
    return next;
  }, [sort, category, keyword]);

  const feed = useInfiniteQuery({
    queryKey: ['feed', baseParams.toString()],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams(baseParams);
      params.set('page', String(pageParam));
      return api.feed(params);
    },
    getNextPageParam: (lastPage, allPages) => {
      const totalPages = lastPage.pages ?? Math.ceil((lastPage.total ?? 0) / Math.max(1, lastPage.size ?? 20));
      return allPages.length < totalPages ? allPages.length : undefined;
    }
  });
  const records = useMemo(() => {
    const topicsById = new Map<number, TopicFeedItem>();
    feed.data?.pages.forEach((pageData) => {
      pageData.records.forEach((topic) => {
        if (!topicsById.has(topic.id)) topicsById.set(topic.id, topic);
      });
    });
    return [...topicsById.values()];
  }, [feed.data?.pages]);
  const totalTopicCount = feed.data?.pages[0]?.total ?? records.length;
  const loadMoreTopics = useCallback(() => {
    if (!feed.hasNextPage || feed.isFetchingNextPage) return;
    void feed.fetchNextPage();
  }, [feed.fetchNextPage, feed.hasNextPage, feed.isFetchingNextPage]);
  const feedSummary = useMemo(() => {
    const opinions = records.reduce((sum, topic) => sum + (topic.opinionCount ?? 0), 0);
    const replies = records.reduce((sum, topic) => sum + (topic.replyCount ?? 0), 0);
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
      topics: totalTopicCount,
      loadedTopics: records.length,
      opinions,
      replies,
      topCategory,
      mostDiscussed,
      newestActive,
      mostBranched
    };
  }, [records, totalTopicCount]);

  return (
    <div className={`home-forest-page home-forest-${sceneTheme} ${panelsHidden ? 'home-panels-hidden' : ''}`}>
      {records.length > 0 && (
        <TopicForestScene
          topics={records}
          totalCount={totalTopicCount}
          theme={sceneTheme}
          hasMore={Boolean(feed.hasNextPage)}
          isLoadingMore={feed.isFetchingNextPage}
          onNeedMore={loadMoreTopics}
        />
      )}
      <button
        className="home-panel-toggle"
        onClick={() => setPanelsHidden((hidden) => !hidden)}
        type="button"
        aria-pressed={panelsHidden}
        aria-label={panelsHidden ? 'Show panels' : 'Hide panels'}
        title={panelsHidden ? 'Show panels' : 'Hide panels'}
      >
        {panelsHidden ? <Eye size={18} /> : <EyeOff size={18} />}
      </button>
      <div className="home-forest-overlay">
        <section className="home-control-panel">
          <div className="feed-summary">
          <div>
            <span className="eyebrow">Debate feed</span>
            <h1>Browse structured discussions</h1>
          </div>
          <div className="feed-summary-grid">
            <span>
              <strong>
                {feedSummary.loadedTopics}/{feedSummary.topics}
              </strong>
              loaded
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
          <button
            className="theme-toggle"
            onClick={() => setSceneTheme((value) => (value === 'day' ? 'night' : 'day'))}
            type="button"
          >
            {sceneTheme === 'day' ? <Sun size={17} /> : <Moon size={17} />}
            <span>{sceneTheme === 'day' ? 'Day' : 'Night'}</span>
          </button>
          <label className="search-box">
            <Search size={18} />
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
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
              }}
              type="button"
            >
              {item}
            </button>
          ))}
          </div>
        </section>
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
        {records.length > 0 && (
          <div className="forest-load-status home-pager">
            {feed.isFetchingNextPage
              ? 'Growing more trees...'
              : feed.hasNextPage
                ? 'Scroll forward through the forest to load more topics'
                : 'End of the ranked grove'}
          </div>
        )}
        <aside className="sidebar home-side-panel">
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
                }}
                type="button"
              >
                {item}
              </button>
            ))}
        </div>
        </aside>
      </div>
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
