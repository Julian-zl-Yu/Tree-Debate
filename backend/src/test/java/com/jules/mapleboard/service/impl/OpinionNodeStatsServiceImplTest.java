package com.jules.mapleboard.service.impl;

import com.jules.mapleboard.domain.OpinionLike;
import com.jules.mapleboard.domain.OpinionNode;
import com.jules.mapleboard.domain.OpinionNodeStats;
import com.jules.mapleboard.domain.OpinionReport;
import com.jules.mapleboard.domain.ReportType;
import com.jules.mapleboard.domain.User;
import com.jules.mapleboard.domain.UserLevel;
import com.jules.mapleboard.mapper.OpinionLikeMapper;
import com.jules.mapleboard.mapper.OpinionNodeMapper;
import com.jules.mapleboard.mapper.OpinionNodeStatsMapper;
import com.jules.mapleboard.mapper.OpinionReplyUserMapper;
import com.jules.mapleboard.mapper.OpinionReportMapper;
import com.jules.mapleboard.mapper.UserMapper;
import com.jules.mapleboard.mapper.UserReceivedLikeUserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OpinionNodeStatsServiceImplTest {
    @Mock
    private OpinionNodeStatsMapper statsMapper;
    @Mock
    private OpinionLikeMapper likeMapper;
    @Mock
    private OpinionReplyUserMapper replyUserMapper;
    @Mock
    private OpinionReportMapper reportMapper;
    @Mock
    private OpinionNodeMapper opinionNodeMapper;
    @Mock
    private UserMapper userMapper;
    @Mock
    private UserReceivedLikeUserMapper userReceivedLikeUserMapper;

    private OpinionNodeStatsServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new OpinionNodeStatsServiceImpl(
                statsMapper,
                likeMapper,
                replyUserMapper,
                reportMapper,
                opinionNodeMapper,
                userMapper,
                userReceivedLikeUserMapper
        );
    }

    @Test
    void recordLikeAddsOneLikeAndUpdatesWeight() {
        OpinionNode opinion = opinion(1L, 10L);
        OpinionNodeStats stats = stats(1L);
        User author = user(10L, UserLevel.OFFICIAL);

        when(statsMapper.selectById(1L)).thenReturn(stats);
        when(likeMapper.countByOpinionIdAndUserId(1L, 20L)).thenReturn(0L);
        when(opinionNodeMapper.selectList(any())).thenReturn(List.of());
        when(userReceivedLikeUserMapper.countByAuthorIdAndLikerId(10L, 20L)).thenReturn(0L);
        when(userMapper.selectById(10L)).thenReturn(author);

        service.recordLike(opinion, 20L);

        assertEquals(1, stats.getLikeCount());
        assertEquals(1.0 + Math.log(2.0), stats.getCommentWeight(), 0.0001);
        verify(likeMapper).insert(any(OpinionLike.class));
        verify(userMapper).updateById(author);
    }

    @Test
    void recordLikeIgnoresDuplicateLikeFromSameUser() {
        OpinionNode opinion = opinion(1L, 10L);
        OpinionNodeStats stats = stats(1L);
        stats.setLikeCount(1);

        when(statsMapper.selectById(1L)).thenReturn(stats);
        when(likeMapper.countByOpinionIdAndUserId(1L, 20L)).thenReturn(1L);

        service.recordLike(opinion, 20L);

        // The unique key in the database also protects this, but the service checks first.
        assertEquals(1, stats.getLikeCount());
        verify(likeMapper, never()).insert(any(OpinionLike.class));
        verify(statsMapper, never()).updateById(any(OpinionNodeStats.class));
    }

    @Test
    void adminSpamReportFoldsOpinionAndSetsWeightToZero() {
        OpinionNode opinion = opinion(1L, 10L);
        OpinionNodeStats stats = stats(1L);
        User admin = user(99L, UserLevel.ADMIN);
        ArgumentCaptor<OpinionReport> reportCaptor = ArgumentCaptor.forClass(OpinionReport.class);

        when(statsMapper.selectById(1L)).thenReturn(stats);
        when(opinionNodeMapper.selectList(any())).thenReturn(List.of());

        service.recordReport(opinion, admin, ReportType.SPAM, "spam link");

        assertTrue(opinion.getFolded());
        assertEquals(2.0, stats.getReportScoreSpam(), 0.0001);
        assertEquals(0.0, stats.getCommentWeight(), 0.0001);
        verify(reportMapper).insert(reportCaptor.capture());
        assertEquals(2.0, reportCaptor.getValue().getWeight().doubleValue(), 0.0001);
        verify(opinionNodeMapper).updateById(opinion);
    }

    private OpinionNode opinion(Long id, Long authorId) {
        OpinionNode opinion = new OpinionNode();
        opinion.setId(id);
        opinion.setTopicId(1L);
        opinion.setAuthorId(authorId);
        opinion.setFolded(false);
        opinion.setCreatedAt(LocalDateTime.now().minusHours(2));
        return opinion;
    }

    private OpinionNodeStats stats(Long opinionId) {
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
        return stats;
    }

    private User user(Long id, UserLevel level) {
        User user = new User();
        user.setId(id);
        user.setUsername("user" + id);
        user.setUserLevel(level);
        user.setReceivedLikeUserCount(0);
        user.setCreatedAt(LocalDateTime.now().minusDays(20));
        return user;
    }
}
