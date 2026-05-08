export type Page<T> = {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages?: number;
};

export type TopicFeedItem = {
  id: number;
  category: string;
  title: string;
  content: string;
  authorId: number;
  author: string;
  createdAt: string;
  opinionCount: number;
  replyCount: number;
};

export type Topic = {
  id: number;
  category: string;
  title: string;
  content: string;
  authorId: number;
  author: string;
  createdAt: string;
};

export type Stance = 'AGREE' | 'NEUTRAL' | 'DISAGREE';
export type ReportType = 'SPAM' | 'HARASSMENT' | 'OFFTOPIC';

export type CurrentUser = {
  id: number;
  username: string;
  enabled: boolean;
  userLevel: 'NEW' | 'OFFICIAL' | 'REPUTABLE' | 'ADMIN';
  receivedLikeUserCount: number;
  createdAt: string;
  roles: string[];
};

export type OpinionNode = {
  id: number;
  topicId: number;
  parentId: number | null;
  authorId: number;
  author: string;
  stance: Stance;
  effectiveTopicStance: Stance;
  topicStanceExplicit: boolean;
  content: string;
  folded: boolean;
  createdAt: string;
  updatedAt: string | null;
  children: OpinionNode[];
};

export type AdminReportedOpinion = {
  id: number;
  topicId: number;
  topicTitle: string;
  parentId: number | null;
  authorId: number;
  author: string;
  stance: Stance;
  effectiveTopicStance: Stance;
  topicStanceExplicit: boolean;
  content: string;
  folded: boolean;
  createdAt: string;
  updatedAt: string | null;
  likeCount: number;
  replyCount: number;
  uniqueReplyUserCount: number;
  reportScoreSpam: number;
  reportScoreHarassment: number;
  reportScoreOfftopic: number;
  commentWeight: number;
  wAgree: number;
  wNeutral: number;
  wDisagree: number;
  opinionEntropy: number;
  engagementWeight: number;
  freshnessFactor: number;
  finalScore: number;
};

export type AdminOpinionReport = {
  id: number;
  opinionId: number;
  reporterId: number;
  reporter: string;
  reportType: ReportType;
  weight: number;
  reason: string | null;
  createdAt: string;
};

export type AdminTopic = {
  id: number;
  category: string;
  title: string;
  content: string;
  authorId: number;
  author: string;
  createdAt: string;
  opinionCount: number;
  replyCount: number;
  foldedOpinionCount: number;
  reportedOpinionCount: number;
  opinionEntropy: number;
  engagementWeight: number;
  freshnessFactor: number;
  finalScore: number;
};
