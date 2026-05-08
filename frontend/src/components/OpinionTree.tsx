import { Flag, Heart, MessageSquare, Pencil } from 'lucide-react';
import type { OpinionNode, Stance } from '../api/types';
import { formatDateTime } from '../utils/format';
import { StanceBadge } from './StanceBadge';

type OpinionTreeProps = {
  nodes: OpinionNode[];
  currentUserId?: number;
  onReply: (node: OpinionNode) => void;
  onEdit: (node: OpinionNode) => void;
  onLike: (node: OpinionNode) => void;
  onReport: (node: OpinionNode) => void;
};

export function OpinionTree({ nodes, currentUserId, onReply, onEdit, onLike, onReport }: OpinionTreeProps) {
  return (
    <div className="opinion-tree">
      {nodes.map((node) => (
        <OpinionBranch
          key={node.id}
          node={node}
          currentUserId={currentUserId}
          onReply={onReply}
          onEdit={onEdit}
          onLike={onLike}
          onReport={onReport}
        />
      ))}
    </div>
  );
}

type OpinionBranchProps = Omit<OpinionTreeProps, 'nodes'> & {
  node: OpinionNode;
};

function OpinionBranch(props: OpinionBranchProps) {
  const { node, currentUserId, onReply, onEdit, onLike, onReport } = props;
  const isOwner = currentUserId === node.authorId;

  return (
    <article className={`opinion-node ${node.folded ? 'opinion-folded' : ''}`}>
      <div className="opinion-line" />
      <div className="opinion-body">
        <div className="opinion-meta">
          <StanceBadge stance={node.stance} />
          <span>u/{node.author}</span>
          <span>{formatDateTime(node.createdAt)}</span>
          {node.folded && <span className="folded-label">Folded</span>}
        </div>
        <p>{node.folded ? 'This opinion is folded pending moderation.' : node.content}</p>
        <div className="opinion-actions">
          {!isOwner && (
            <button type="button" onClick={() => onReply(node)}>
              <MessageSquare size={16} />
              Reply
            </button>
          )}
          {isOwner && (
            <button type="button" onClick={() => onEdit(node)}>
              <Pencil size={16} />
              Edit
            </button>
          )}
          <button type="button" onClick={() => onLike(node)}>
            <Heart size={16} />
            Like
          </button>
          <button type="button" onClick={() => onReport(node)}>
            <Flag size={16} />
            Report
          </button>
        </div>
        {node.children.length > 0 && (
          <div className="opinion-children">
            {node.children.map((child) => (
              <OpinionBranch
                key={child.id}
                node={child}
                currentUserId={currentUserId}
                onReply={onReply}
                onEdit={onEdit}
                onLike={onLike}
                onReport={onReport}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export const stances: Stance[] = ['AGREE', 'NEUTRAL', 'DISAGREE'];
