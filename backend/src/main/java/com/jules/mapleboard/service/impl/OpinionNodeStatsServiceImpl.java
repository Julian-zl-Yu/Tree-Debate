package com.jules.mapleboard.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.jules.mapleboard.domain.OpinionLike;
import com.jules.mapleboard.domain.OpinionNode;
import com.jules.mapleboard.domain.OpinionNodeStats;
import com.jules.mapleboard.domain.OpinionReplyUser;
import com.jules.mapleboard.domain.OpinionReport;
import com.jules.mapleboard.domain.ReportType;
import com.jules.mapleboard.domain.Stance;
import com.jules.mapleboard.domain.User;
import com.jules.mapleboard.domain.UserLevel;
import com.jules.mapleboard.domain.UserReceivedLikeUser;
import com.jules.mapleboard.exception.DuplicateOpinionReportException;
import com.jules.mapleboard.mapper.OpinionLikeMapper;
import com.jules.mapleboard.mapper.OpinionNodeStatsMapper;
import com.jules.mapleboard.mapper.OpinionNodeMapper;
import com.jules.mapleboard.mapper.OpinionReplyUserMapper;
import com.jules.mapleboard.mapper.OpinionReportMapper;
import com.jules.mapleboard.mapper.UserMapper;
import com.jules.mapleboard.mapper.UserReceivedLikeUserMapper;
import com.jules.mapleboard.service.OpinionNodeStatsService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Collections;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class OpinionNodeStatsServiceImpl implements OpinionNodeStatsService {
    private static final double SPAM_FOLD_THRESHOLD = 2.0;
    private static final double HARASSMENT_FOLD_THRESHOLD = 3.0;
    private static final double OFFTOPIC_FOLD_THRESHOLD = 5.0;

    private final OpinionNodeStatsMapper statsMapper;
    private final OpinionLikeMapper likeMapper;
    private final OpinionReplyUserMapper replyUserMapper;
    private final OpinionReportMapper reportMapper;
    private final OpinionNodeMapper opinionNodeMapper;
    private final UserMapper userMapper;
    private final UserReceivedLikeUserMapper userReceivedLikeUserMapper;

    public OpinionNodeStatsServiceImpl(OpinionNodeStatsMapper statsMapper,
                                       OpinionLikeMapper likeMapper,
                                       OpinionReplyUserMapper replyUserMapper,
                                       OpinionReportMapper reportMapper,
                                       OpinionNodeMapper opinionNodeMapper,
                                       UserMapper userMapper,
                                       UserReceivedLikeUserMapper userReceivedLikeUserMapper) {
        this.statsMapper = statsMapper;
        this.likeMapper = likeMapper;
        this.replyUserMapper = replyUserMapper;
        this.reportMapper = reportMapper;
        this.opinionNodeMapper = opinionNodeMapper;
        this.userMapper = userMapper;
        this.userReceivedLikeUserMapper = userReceivedLikeUserMapper;
    }

    @Override
    @Transactional
    public OpinionNodeStats initializeStats(Long opinionId) {
        OpinionNodeStats existing = statsMapper.selectById(opinionId);
        if (existing != null) {
            return existing;
        }

        OpinionNodeStats stats = new OpinionNodeStats();
        stats.setOpinionId(opinionId);
        stats.setLikeCount(0);
        stats.setReplyCount(0);
        stats.setUniqueReplyUserCount(0);
        stats.setReportScoreSpam(0.0);
        stats.setReportScoreHarassment(0.0);
        stats.setReportScoreOfftopic(0.0);
        stats.setCommentWeight(1.0);
        stats.setWAgree(0.0);
        stats.setWNeutral(0.0);
        stats.setWDisagree(0.0);
        stats.setOpinionEntropy(0.0);
        stats.setEngagementWeight(1.0);
        stats.setFreshnessFactor(1.0);
        stats.setFinalScore(0.0);
        statsMapper.insert(stats);
        return stats;
    }

    @Override
    @Transactional
    public OpinionNodeStats recordReply(OpinionNode parent, Stance replyStance, Long userId) {
        OpinionNodeStats stats = initializeStats(parent.getId());
        stats.setReplyCount(value(stats.getReplyCount()) + 1);
        if (recordUniqueReplyUser(parent.getId(), userId)) {
            stats.setUniqueReplyUserCount(value(stats.getUniqueReplyUserCount()) + 1);
        }

        statsMapper.updateById(stats);
        recalculateNodeAndAncestors(parent);
        return statsMapper.selectById(parent.getId());
    }

    @Override
    @Transactional
    public OpinionNodeStats recordLike(OpinionNode opinion, Long userId) {
        OpinionNodeStats stats = initializeStats(opinion.getId());
        if (hasLiked(opinion.getId(), userId)) {
            return stats;
        }

        OpinionLike like = new OpinionLike();
        like.setOpinionId(opinion.getId());
        like.setUserId(userId);
        try {
            likeMapper.insert(like);
        } catch (DuplicateKeyException ignored) {
            return statsMapper.selectById(opinion.getId());
        }

        stats.setLikeCount(value(stats.getLikeCount()) + 1);
        statsMapper.updateById(stats);
        recordReceivedLikeUser(opinion, userId);
        recalculateNodeAndAncestors(opinion);
        stats = statsMapper.selectById(opinion.getId());
        return stats;
    }

    @Override
    @Transactional
    public OpinionNodeStats recordReport(OpinionNode opinion, User reporter, ReportType reportType, String reason) {
        OpinionNodeStats stats = initializeStats(opinion.getId());

        OpinionReport report = new OpinionReport();
        report.setOpinionId(opinion.getId());
        report.setReporterId(reporter.getId());
        report.setReportType(reportType);
        report.setWeight(BigDecimal.valueOf(reportWeight(reporter)));
        report.setReason(reason);

        try {
            reportMapper.insert(report);
        } catch (DuplicateKeyException ignored) {
            throw new DuplicateOpinionReportException();
        }

        double weight = report.getWeight().doubleValue();
        if (reportType == ReportType.SPAM) {
            stats.setReportScoreSpam(value(stats.getReportScoreSpam()) + weight);
        } else if (reportType == ReportType.HARASSMENT) {
            stats.setReportScoreHarassment(value(stats.getReportScoreHarassment()) + weight);
        } else if (reportType == ReportType.OFFTOPIC) {
            stats.setReportScoreOfftopic(value(stats.getReportScoreOfftopic()) + weight);
        }

        boolean shouldFold = Boolean.TRUE.equals(opinion.getFolded()) || shouldFold(stats);
        recalculate(stats, opinion, shouldFold);
        statsMapper.updateById(stats);

        if (shouldFold && !Boolean.TRUE.equals(opinion.getFolded())) {
            opinion.setFolded(true);
            opinionNodeMapper.updateById(opinion);
            recalculateNodeAndAncestors(opinion);
        }

        return stats;
    }

    @Override
    @Transactional
    public OpinionNodeStats deleteReport(Long reportId) {
        OpinionReport report = reportMapper.selectById(reportId);
        if (report == null) {
            return null;
        }

        OpinionNode opinion = opinionNodeMapper.selectById(report.getOpinionId());
        reportMapper.deleteById(reportId);
        if (opinion == null) {
            return null;
        }

        OpinionNodeStats stats = initializeStats(opinion.getId());
        recomputeReportScores(stats, opinion.getId());
        boolean shouldFold = shouldFold(stats);
        opinion.setFolded(shouldFold);
        opinionNodeMapper.updateById(opinion);
        recalculate(stats, opinion, shouldFold);
        statsMapper.updateById(stats);
        recalculateNodeAndAncestors(opinion);
        return statsMapper.selectById(opinion.getId());
    }

    @Override
    @Transactional
    public OpinionNodeStats setFolded(OpinionNode opinion, boolean folded) {
        OpinionNodeStats stats = initializeStats(opinion.getId());
        opinion.setFolded(folded);
        opinionNodeMapper.updateById(opinion);
        recalculate(stats, opinion, folded);
        statsMapper.updateById(stats);
        recalculateNodeAndAncestors(opinion);
        return statsMapper.selectById(opinion.getId());
    }

    @Override
    public Map<Long, OpinionNodeStats> listStats(Collection<Long> opinionIds) {
        if (opinionIds == null || opinionIds.isEmpty()) {
            return Collections.emptyMap();
        }
        return statsMapper.selectBatchIds(opinionIds).stream()
                .collect(Collectors.toMap(OpinionNodeStats::getOpinionId, Function.identity()));
    }

    private boolean hasLiked(Long opinionId, Long userId) {
        return likeMapper.countByOpinionIdAndUserId(opinionId, userId) > 0;
    }

    private boolean recordUniqueReplyUser(Long opinionId, Long userId) {
        if (replyUserMapper.countByOpinionIdAndUserId(opinionId, userId) > 0) {
            return false;
        }

        OpinionReplyUser replyUser = new OpinionReplyUser();
        replyUser.setOpinionId(opinionId);
        replyUser.setUserId(userId);
        try {
            replyUserMapper.insert(replyUser);
            return true;
        } catch (DuplicateKeyException ignored) {
            return false;
        }
    }

    private double reportWeight(User reporter) {
        if (reporter.getUserLevel() == UserLevel.ADMIN) {
            return 2.0;
        }
        if (reporter.getCreatedAt() == null
                || Duration.between(reporter.getCreatedAt(), LocalDateTime.now()).toDays() < 14) {
            return 0.5;
        }
        if (value(reporter.getReceivedLikeUserCount()) >= 100) {
            return 1.5;
        }
        return 1.0;
    }

    private boolean shouldFold(OpinionNodeStats stats) {
        return value(stats.getReportScoreSpam()) >= SPAM_FOLD_THRESHOLD
                || value(stats.getReportScoreHarassment()) >= HARASSMENT_FOLD_THRESHOLD
                || value(stats.getReportScoreOfftopic()) >= OFFTOPIC_FOLD_THRESHOLD;
    }

    private void recomputeReportScores(OpinionNodeStats stats, Long opinionId) {
        stats.setReportScoreSpam(0.0);
        stats.setReportScoreHarassment(0.0);
        stats.setReportScoreOfftopic(0.0);

        java.util.List<OpinionReport> reports = reportMapper.selectList(new LambdaQueryWrapper<OpinionReport>()
                .eq(OpinionReport::getOpinionId, opinionId));
        for (OpinionReport report : reports) {
            double weight = report.getWeight() == null ? 0.0 : report.getWeight().doubleValue();
            if (report.getReportType() == ReportType.SPAM) {
                stats.setReportScoreSpam(value(stats.getReportScoreSpam()) + weight);
            } else if (report.getReportType() == ReportType.HARASSMENT) {
                stats.setReportScoreHarassment(value(stats.getReportScoreHarassment()) + weight);
            } else if (report.getReportType() == ReportType.OFFTOPIC) {
                stats.setReportScoreOfftopic(value(stats.getReportScoreOfftopic()) + weight);
            }
        }
    }

    private void recalculateNodeAndAncestors(OpinionNode node) {
        OpinionNode current = node;
        while (current != null) {
            OpinionNodeStats currentStats = initializeStats(current.getId());
            recalculate(currentStats, current, Boolean.TRUE.equals(current.getFolded()));
            statsMapper.updateById(currentStats);
            current = current.getParentId() == null ? null : opinionNodeMapper.selectById(current.getParentId());
        }
    }

    private void recalculate(OpinionNodeStats stats, OpinionNode opinion, boolean folded) {
        stats.setCommentWeight(commentWeight(stats, folded));
        stats.setWAgree(0.0);
        stats.setWNeutral(0.0);
        stats.setWDisagree(0.0);

        java.util.List<OpinionNode> children = opinionNodeMapper.selectList(new LambdaQueryWrapper<OpinionNode>()
                .eq(OpinionNode::getParentId, opinion.getId()));
        stats.setReplyCount(children.size());

        for (OpinionNode child : children) {
            OpinionNodeStats childStats = initializeStats(child.getId());
            recalculate(childStats, child, Boolean.TRUE.equals(child.getFolded()));
            statsMapper.updateById(childStats);
            double childWeight = value(childStats.getCommentWeight());
            if (childWeight > 0.0) {
                addStanceWeight(stats, child.getStance(), childWeight);
            }
        }

        double agree = value(stats.getWAgree());
        double disagree = value(stats.getWDisagree());
        double polarized = agree + disagree;

        double entropy = 0.0;
        if (polarized > 0.0 && agree > 0.0 && disagree > 0.0) {
            double pAgree = agree / polarized;
            double pDisagree = disagree / polarized;
            entropy = entropyTerm(pAgree) + entropyTerm(pDisagree);
        }

        double weightedInteractions = agree
                + value(stats.getWNeutral())
                + disagree;
        double engagementWeight = 1.0 + Math.log(weightedInteractions + 1.0);
        double freshnessFactor = freshnessFactor(opinion.getCreatedAt());
        double finalScore = entropy * engagementWeight * freshnessFactor;

        stats.setOpinionEntropy(entropy);
        stats.setEngagementWeight(engagementWeight);
        stats.setFreshnessFactor(freshnessFactor);
        stats.setFinalScore(finalScore);
    }

    private double commentWeight(OpinionNodeStats stats, boolean folded) {
        if (folded) {
            return 0.0;
        }
        return 1.0
                + Math.log(value(stats.getLikeCount()) + 1.0)
                + 0.5 * Math.log(value(stats.getUniqueReplyUserCount()) + 1.0);
    }

    private void addStanceWeight(OpinionNodeStats stats, Stance stance, double weight) {
        if (stance == Stance.AGREE) {
            stats.setWAgree(value(stats.getWAgree()) + weight);
        } else if (stance == Stance.NEUTRAL) {
            stats.setWNeutral(value(stats.getWNeutral()) + weight);
        } else if (stance == Stance.DISAGREE) {
            stats.setWDisagree(value(stats.getWDisagree()) + weight);
        }
    }

    private void recordReceivedLikeUser(OpinionNode opinion, Long likerId) {
        if (opinion.getAuthorId() == null || opinion.getAuthorId().equals(likerId)
                || userReceivedLikeUserMapper.countByAuthorIdAndLikerId(opinion.getAuthorId(), likerId) > 0) {
            return;
        }

        UserReceivedLikeUser receivedLikeUser = new UserReceivedLikeUser();
        receivedLikeUser.setAuthorId(opinion.getAuthorId());
        receivedLikeUser.setLikerId(likerId);
        try {
            userReceivedLikeUserMapper.insert(receivedLikeUser);
            User author = userMapper.selectById(opinion.getAuthorId());
            if (author != null) {
                author.setReceivedLikeUserCount(value(author.getReceivedLikeUserCount()) + 1);
                userMapper.updateById(author);
            }
        } catch (DuplicateKeyException ignored) {
            // another request already recorded this distinct liker
        }
    }

    private double entropyTerm(double p) {
        if (p <= 0.0) {
            return 0.0;
        }
        return -p * Math.log(p);
    }

    private double freshnessFactor(LocalDateTime createdAt) {
        if (createdAt == null) {
            return 1.0;
        }
        long hours = Math.max(0, Duration.between(createdAt, LocalDateTime.now()).toHours());
        return Math.max(0.3, 1.0 / (hours / 24.0 + 1.0));
    }

    private int value(Integer value) {
        return value == null ? 0 : value;
    }

    private double value(Double value) {
        return value == null ? 0.0 : value;
    }
}
