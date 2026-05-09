import { Flag, Heart, MessageSquare, Minus, Move, Pencil, Plus, RotateCcw } from 'lucide-react';
import { useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import type { OpinionNode, Stance } from '../api/types';
import { excerpt, formatDateTime } from '../utils/format';
import { StanceBadge } from './StanceBadge';

type TreeOrientation = 'vertical' | 'horizontal';

type OpinionTreeProps = {
  topicTitle: string;
  topicContent: string;
  topicCategory?: string;
  topicAuthor?: string;
  nodes: OpinionNode[];
  currentUserId?: number;
  onReply: (node: OpinionNode) => void;
  onEdit: (node: OpinionNode) => void;
  onLike: (node: OpinionNode) => void;
  onReport: (node: OpinionNode) => void;
};

type MindNode = {
  key: string;
  type: 'topic' | 'opinion';
  topicTitle?: string;
  topicContent?: string;
  topicCategory?: string;
  topicAuthor?: string;
  opinion?: OpinionNode;
  children: MindNode[];
};

type LayoutBranch = {
  node: MindNode;
  span: number;
  children: LayoutBranch[];
};

type LayoutNode = {
  node: MindNode;
  centerX: number;
  centerY: number;
  left: number;
  top: number;
};

type LayoutEdge = {
  childKey: string;
  parentKey: string;
  stance: Stance;
};

const nodeWidth = 290;
const nodeHeight = 174;
const siblingGap = 72;
const levelGap = 112;
const canvasPadding = 96;
const stanceColors: Record<Stance, string> = {
  AGREE: '#218552',
  NEUTRAL: '#6a7880',
  DISAGREE: '#bd3645'
};

export function OpinionTree(props: OpinionTreeProps) {
  const { topicTitle, topicContent, topicCategory, topicAuthor, nodes, currentUserId, onReply, onEdit, onLike, onReport } = props;
  const [orientation, setOrientation] = useState<TreeOrientation>('vertical');
  const [scale, setScale] = useState(0.9);
  const [offset, setOffset] = useState({ x: 28, y: 28 });
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef<{ pointerId: number; startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
  const layout = useMemo(
    () => buildLayout(topicTitle, topicContent, topicCategory, topicAuthor, nodes, orientation),
    [topicTitle, topicContent, topicCategory, topicAuthor, nodes, orientation]
  );
  const nodeByKey = useMemo(() => new Map(layout.nodes.map((node) => [node.node.key, node])), [layout.nodes]);

  function resetView() {
    setScale(0.9);
    setOffset({ x: 28, y: 28 });
  }

  function zoomBy(delta: number) {
    setScale((value) => Math.min(1.7, Math.max(0.45, Number((value + delta).toFixed(2)))));
  }

  function zoomAtPoint(delta: number, anchorX: number, anchorY: number) {
    const nextScale = Math.min(1.7, Math.max(0.45, Number((scale + delta).toFixed(2))));
    if (nextScale === scale) {
      return;
    }
    const stageX = (anchorX - offset.x) / scale;
    const stageY = (anchorY - offset.y) / scale;
    setOffset({
      x: anchorX - stageX * nextScale,
      y: anchorY - stageY * nextScale
    });
    setScale(nextScale);
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    zoomAtPoint(event.deltaY > 0 ? -0.08 : 0.08, event.clientX - rect.left, event.clientY - rect.top);
  }

  function startPan(event: PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest('.mind-node') || target.closest('.tree-toolbar')) {
      return;
    }
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePan(event: PointerEvent<HTMLDivElement>) {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    setOffset({
      x: drag.offsetX + event.clientX - drag.startX,
      y: drag.offsetY + event.clientY - drag.startY
    });
  }

  function stopPan(event: PointerEvent<HTMLDivElement>) {
    if (dragState.current?.pointerId === event.pointerId) {
      dragState.current = null;
      setIsDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }

  return (
    <section className="tree-map-shell">
      <div className="tree-toolbar">
        <div className="segmented">
          <button className={orientation === 'vertical' ? 'active' : ''} onClick={() => setOrientation('vertical')} type="button">
            Top-down
          </button>
          <button className={orientation === 'horizontal' ? 'active' : ''} onClick={() => setOrientation('horizontal')} type="button">
            Left-right
          </button>
        </div>
        <div className="tree-zoom-controls">
          <Move size={16} className="muted-icon" />
          <button onClick={() => zoomBy(-0.1)} type="button" title="Zoom out">
            <Minus size={16} />
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button onClick={() => zoomBy(0.1)} type="button" title="Zoom in">
            <Plus size={16} />
          </button>
          <button onClick={resetView} type="button" title="Reset view">
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
      <div
        className={`tree-canvas ${isDragging ? 'is-dragging' : ''}`}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={stopPan}
        onPointerCancel={stopPan}
        onWheel={handleWheel}
      >
        <div
          className="tree-stage"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`
          }}
        >
          <svg className="tree-edges" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`}>
            <defs>
              {stances.map((stance) => (
                <marker
                  id={`tree-arrow-${stance.toLowerCase()}`}
                  key={stance}
                  markerHeight="8"
                  markerWidth="8"
                  orient="auto"
                  refX="7"
                  refY="4"
                  viewBox="0 0 8 8"
                >
                  <path d="M0,0 L8,4 L0,8 Z" fill={stanceColors[stance]} />
                </marker>
              ))}
            </defs>
            {layout.edges.map((edge) => {
              const child = nodeByKey.get(edge.childKey);
              const parent = nodeByKey.get(edge.parentKey);
              if (!child || !parent) {
                return null;
              }
              return (
                <path
                  className="tree-edge"
                  d={edgePath(child, parent, orientation)}
                  key={`${edge.childKey}-${edge.parentKey}`}
                  markerEnd={`url(#tree-arrow-${edge.stance.toLowerCase()})`}
                  stroke={stanceColors[edge.stance]}
                />
              );
            })}
          </svg>
          <div className="tree-node-layer">
            {layout.nodes.map((layoutNode) => (
              <MindMapNode
                currentUserId={currentUserId}
                key={layoutNode.node.key}
                layoutNode={layoutNode}
                onEdit={onEdit}
                onLike={onLike}
                onReport={onReport}
                onReply={onReply}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MindMapNode(props: {
  layoutNode: LayoutNode;
  currentUserId?: number;
  onReply: (node: OpinionNode) => void;
  onEdit: (node: OpinionNode) => void;
  onLike: (node: OpinionNode) => void;
  onReport: (node: OpinionNode) => void;
}) {
  const { layoutNode, currentUserId, onReply, onEdit, onLike, onReport } = props;
  const { node } = layoutNode;

  if (node.type === 'topic') {
    return (
      <article className="mind-node mind-node-topic" style={{ left: layoutNode.left, top: layoutNode.top }}>
        <div className="mind-node-meta">
          <span>Topic root</span>
          {node.topicCategory && <span>{node.topicCategory}</span>}
          {node.topicAuthor && <span>u/{node.topicAuthor}</span>}
        </div>
        <h3>{node.topicTitle}</h3>
        <p>{excerpt(node.topicContent ?? '', 116)}</p>
      </article>
    );
  }

  const opinion = node.opinion!;
  const isOwner = currentUserId === opinion.authorId;

  return (
    <article
      className={`mind-node mind-node-${opinion.stance.toLowerCase()} ${opinion.folded ? 'mind-node-folded' : ''}`}
      style={{ left: layoutNode.left, top: layoutNode.top }}
    >
      <div className="mind-node-meta">
        <StanceBadge stance={opinion.stance} />
        <span>topic {opinion.effectiveTopicStance}</span>
        {opinion.folded && <span className="folded-label">Folded</span>}
      </div>
      <p>{opinion.folded ? 'This opinion is folded pending moderation.' : excerpt(opinion.content, 112)}</p>
      <div className="mind-node-footer">
        <span>u/{opinion.author}</span>
        <span>{formatDateTime(opinion.createdAt)}</span>
      </div>
      <div className="opinion-actions mind-node-actions">
        {!isOwner && (
          <button type="button" onClick={() => onReply(opinion)}>
            <MessageSquare size={15} />
            Reply
          </button>
        )}
        {isOwner && (
          <button type="button" onClick={() => onEdit(opinion)}>
            <Pencil size={15} />
            Edit
          </button>
        )}
        <button type="button" onClick={() => onLike(opinion)}>
          <Heart size={15} />
          Like
        </button>
        <button type="button" onClick={() => onReport(opinion)}>
          <Flag size={15} />
          Report
        </button>
      </div>
    </article>
  );
}

function buildLayout(
  topicTitle: string,
  topicContent: string,
  topicCategory: string | undefined,
  topicAuthor: string | undefined,
  nodes: OpinionNode[],
  orientation: TreeOrientation
) {
  const root: MindNode = {
    key: 'topic-root',
    type: 'topic',
    topicTitle,
    topicContent,
    topicCategory,
    topicAuthor,
    children: nodes.map(toMindNode)
  };
  const branch = measure(root, orientation);
  const rawNodes: Array<Omit<LayoutNode, 'left' | 'top'>> = [];
  const edges: LayoutEdge[] = [];
  place(branch, 0, 0, orientation, rawNodes, edges);

  let minLeft = Number.POSITIVE_INFINITY;
  let minTop = Number.POSITIVE_INFINITY;
  let maxRight = Number.NEGATIVE_INFINITY;
  let maxBottom = Number.NEGATIVE_INFINITY;

  for (const node of rawNodes) {
    minLeft = Math.min(minLeft, node.centerX - nodeWidth / 2);
    minTop = Math.min(minTop, node.centerY - nodeHeight / 2);
    maxRight = Math.max(maxRight, node.centerX + nodeWidth / 2);
    maxBottom = Math.max(maxBottom, node.centerY + nodeHeight / 2);
  }

  const shiftX = canvasPadding - minLeft;
  const shiftY = canvasPadding - minTop;
  const layoutNodes = rawNodes.map((node) => ({
    ...node,
    centerX: node.centerX + shiftX,
    centerY: node.centerY + shiftY,
    left: node.centerX + shiftX - nodeWidth / 2,
    top: node.centerY + shiftY - nodeHeight / 2
  }));

  return {
    nodes: layoutNodes,
    edges,
    width: Math.max(760, maxRight - minLeft + canvasPadding * 2),
    height: Math.max(520, maxBottom - minTop + canvasPadding * 2)
  };
}

function toMindNode(opinion: OpinionNode): MindNode {
  return {
    key: `opinion-${opinion.id}`,
    type: 'opinion',
    opinion,
    children: opinion.children.map(toMindNode)
  };
}

function measure(node: MindNode, orientation: TreeOrientation): LayoutBranch {
  const children = node.children.map((child) => measure(child, orientation));
  const baseSpan = orientation === 'vertical' ? nodeWidth : nodeHeight;
  const childSpan = children.reduce((sum, child) => sum + child.span, 0) + Math.max(0, children.length - 1) * siblingGap;
  return {
    node,
    children,
    span: Math.max(baseSpan, childSpan)
  };
}

function place(
  branch: LayoutBranch,
  start: number,
  depth: number,
  orientation: TreeOrientation,
  nodes: Array<Omit<LayoutNode, 'left' | 'top'>>,
  edges: LayoutEdge[]
) {
  const centerOnSpan = start + branch.span / 2;
  const centerX = orientation === 'vertical' ? centerOnSpan : depth * (nodeWidth + levelGap);
  const centerY = orientation === 'vertical' ? depth * (nodeHeight + levelGap) : centerOnSpan;
  nodes.push({ node: branch.node, centerX, centerY });

  const childTotal = branch.children.reduce((sum, child) => sum + child.span, 0) + Math.max(0, branch.children.length - 1) * siblingGap;
  let childStart = start + Math.max(0, (branch.span - childTotal) / 2);
  for (const child of branch.children) {
    place(child, childStart, depth + 1, orientation, nodes, edges);
    edges.push({
      childKey: child.node.key,
      parentKey: branch.node.key,
      stance: child.node.opinion?.stance ?? 'NEUTRAL'
    });
    childStart += child.span + siblingGap;
  }
}

function edgePath(child: LayoutNode, parent: LayoutNode, orientation: TreeOrientation) {
  if (orientation === 'vertical') {
    const startX = child.centerX;
    const startY = child.top;
    const endX = parent.centerX;
    const endY = parent.top + nodeHeight;
    const midY = (startY + endY) / 2;
    return `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
  }

  const startX = child.left;
  const startY = child.centerY;
  const endX = parent.left + nodeWidth;
  const endY = parent.centerY;
  const midX = (startX + endX) / 2;
  return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
}

export const stances: Stance[] = ['AGREE', 'NEUTRAL', 'DISAGREE'];
