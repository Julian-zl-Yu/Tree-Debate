import { Flag, Heart, MessageSquare, Pencil } from 'lucide-react';
import type { OpinionNode, ReportType, Stance } from '../api/types';
import { StanceBadge } from './StanceBadge';

type OpinionTreeProps = {
  nodes: OpinionNode[];
  onReply: (node: OpinionNode) => void;
  onEdit: (node: OpinionNode) => void;
  onLike: (node: OpinionNode) => void;
  onReport: (node: OpinionNode, reportType: ReportType) => void;
};

export function OpinionTree({ nodes, onReply, onEdit, onLike, onReport }: OpinionTreeProps) {
  return (
    <div className="opinion-tree">
      {nodes.map((node) => (
        <OpinionBranch
          key={node.id}
          node={node}
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
  const { node, onReply, onEdit, onLike, onReport } = props;

  return (
    <article className={`opinion-node ${node.folded ? 'opinion-folded' : ''}`}>
      <div className="opinion-line" />
      <div className="opinion-body">
        <div className="opinion-meta">
          <StanceBadge stance={node.stance} />
          <span>{node.author}</span>
          <span>{new Date(node.createdAt).toLocaleString()}</span>
          {node.folded && <span className="folded-label">Folded</span>}
        </div>
        <p>{node.folded ? 'This opinion is folded pending moderation.' : node.content}</p>
        <div className="opinion-actions">
          <button type="button" onClick={() => onReply(node)}>
            <MessageSquare size={16} />
            Reply
          </button>
          <button type="button" onClick={() => onEdit(node)}>
            <Pencil size={16} />
            Edit
          </button>
          <button type="button" onClick={() => onLike(node)}>
            <Heart size={16} />
            Like
          </button>
          <select onChange={(event) => event.target.value && onReport(node, event.target.value as ReportType)} defaultValue="">
            <option value="" disabled>
              Report
            </option>
            <option value="SPAM">Spam</option>
            <option value="HARASSMENT">Harassment</option>
            <option value="OFFTOPIC">Off-topic</option>
          </select>
          <Flag size={16} className="muted-icon" />
        </div>
        {node.children.length > 0 && (
          <div className="opinion-children">
            {node.children.map((child) => (
              <OpinionBranch
                key={child.id}
                node={child}
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
