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
import com.jules.mapleboard.mapper.OpinionLikeMapper;
import com.jules.mapleboard.mapper.OpinionNodeStatsMapper;
import com.jules.mapleboard.mapper.OpinionNodeMapper;
import com.jules.mapleboard.mapper.OpinionReplyUserMapper;
import com.jules.mapleboard.mapper.OpinionReportMapper;
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
    private static final double FOLD_REPORT_SCORE_THRESHOLD = 3.0;

    private final OpinionNodeStatsMapper statsMapper;
    private final OpinionLikeMapper likeMapper;
    private final OpinionReplyUserMapper replyUserMapper;
    private final OpinionReportMapper reportMapper;
    private final OpinionNodeMapper opinionNodeMapper;

    public OpinionNodeStatsServiceImpl(OpinionNodeStatsMapper statsMapper,
                                       OpinionLikeMapper likeMapper,
                                       OpinionReplyUserMapper replyUserMapper,
                                       OpinionReportMapper reportMapper,
                                       OpinionNodeMapper opinionNodeMapper) {
        this.statsMapper = statsMapper;
        this.likeMapper = likeMapper;
        this.replyUserMapper = replyUserMapper;
        this.reportMapper = reportMapper;
        this.opinionNodeMapper = opinionNodeMapper;
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

        if (replyStance == Stance.AGREE) {
            stats.setWAgree(value(stats.getWAgree()) + 1.0);
        } else if (replyStance == Stance.NEUTRAL) {
            stats.setWNeutral(value(stats.getWNeutral()) + 1.0);
        } else if (replyStance == Stance.DISAGREE) {
            stats.setWDisagree(value(stats.getWDisagree()) + 1.0);
        }

        recalculate(stats, parent.getCreatedAt());
        statsMapper.updateById(stats);
        return stats;
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
        recalculate(stats, opinion.getCreatedAt());
        statsMapper.updateById(stats);
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
            return statsMapper.selectById(opinion.getId());
        }

        double weight = report.getWeight().doubleValue();
        if (reportType == ReportType.SPAM) {
            stats.setReportScoreSpam(value(stats.getReportScoreSpam()) + weight);
        } else if (reportType == ReportType.HARASSMENT) {
            stats.setReportScoreHarassment(value(stats.getReportScoreHarassment()) + weight);
        } else if (reportType == ReportType.OFFTOPIC) {
            stats.setReportScoreOfftopic(value(stats.getReportScoreOfftopic()) + weight);
        }

        double totalReportScore = totalReportScore(stats);
        boolean shouldFold = totalReportScore >= FOLD_REPORT_SCORE_THRESHOLD;
        stats.setCommentWeight(shouldFold ? 0.0 : 1.0);
        recalculate(stats, opinion.getCreatedAt());
        statsMapper.updateById(stats);

        if (shouldFold && !Boolean.TRUE.equals(opinion.getFolded())) {
            opinion.setFolded(true);
            opinionNodeMapper.updateById(opinion);
            recalculateParentFromChildren(opinion);
        }

        return stats;
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
        UserLevel level = reporter.getUserLevel();
        if (level == UserLevel.ADMIN) {
            return 3.0;
        }
        if (level == UserLevel.REPUTABLE) {
            return 2.0;
        }
        if (level == UserLevel.OFFICIAL) {
            return 1.5;
        }
        return 1.0;
    }

    private double totalReportScore(OpinionNodeStats stats) {
        return value(stats.getReportScoreSpam())
                + value(stats.getReportScoreHarassment())
                + value(stats.getReportScoreOfftopic());
    }

    private void recalculateParentFromChildren(OpinionNode child) {
        if (child.getParentId() == null) {
            return;
        }

        OpinionNode parent = opinionNodeMapper.selectById(child.getParentId());
        if (parent == null) {
            return;
        }

        OpinionNodeStats parentStats = initializeStats(parent.getId());
        parentStats.setWAgree(0.0);
        parentStats.setWNeutral(0.0);
        parentStats.setWDisagree(0.0);

        for (OpinionNode sibling : opinionNodeMapper.selectList(new LambdaQueryWrapper<OpinionNode>()
                .eq(OpinionNode::getParentId, parent.getId()))) {
            OpinionNodeStats siblingStats = initializeStats(sibling.getId());
            double childWeight = value(siblingStats.getCommentWeight());
            if (childWeight <= 0.0) {
                continue;
            }

            if (sibling.getStance() == Stance.AGREE) {
                parentStats.setWAgree(value(parentStats.getWAgree()) + childWeight);
            } else if (sibling.getStance() == Stance.NEUTRAL) {
                parentStats.setWNeutral(value(parentStats.getWNeutral()) + childWeight);
            } else if (sibling.getStance() == Stance.DISAGREE) {
                parentStats.setWDisagree(value(parentStats.getWDisagree()) + childWeight);
            }
        }

        recalculate(parentStats, parent.getCreatedAt());
        statsMapper.updateById(parentStats);
    }

    private void recalculate(OpinionNodeStats stats, LocalDateTime createdAt) {
        double agree = value(stats.getWAgree());
        double disagree = value(stats.getWDisagree());
        double stanceTotal = agree + disagree;

        double entropy = 0.0;
        if (stanceTotal > 0.0) {
            double pAgree = agree / stanceTotal;
            double pDisagree = disagree / stanceTotal;
            entropy = entropyTerm(pAgree) + entropyTerm(pDisagree);
        }

        double weightedInteractions = agree
                + value(stats.getWNeutral())
                + disagree
                + value(stats.getLikeCount());
        double engagementWeight = 1.0 + Math.log(weightedInteractions + 1.0);
        double freshnessFactor = freshnessFactor(createdAt);
        double finalScore = value(stats.getCommentWeight()) * entropy * engagementWeight * freshnessFactor;

        stats.setOpinionEntropy(entropy);
        stats.setEngagementWeight(engagementWeight);
        stats.setFreshnessFactor(freshnessFactor);
        stats.setFinalScore(finalScore);
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
