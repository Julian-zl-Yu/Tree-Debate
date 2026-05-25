package com.jules.mapleboard.web;

import com.jules.mapleboard.domain.OpinionNode;
import com.jules.mapleboard.domain.OpinionNodeStats;
import com.jules.mapleboard.domain.Stance;
import com.jules.mapleboard.domain.Topic;
import com.jules.mapleboard.domain.User;
import com.jules.mapleboard.domain.UserLevel;
import com.jules.mapleboard.dto.OpinionNodeCreateRequest;
import com.jules.mapleboard.dto.OpinionNodeResponse;
import com.jules.mapleboard.mapper.OpinionNodeMapper;
import com.jules.mapleboard.mapper.TopicMapper;
import com.jules.mapleboard.mapper.UserMapper;
import com.jules.mapleboard.service.OpinionNodeStatsService;
import com.jules.mapleboard.service.SensitiveWordFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OpinionNodeControllerTest {
    @Mock
    private TopicMapper topicMapper;
    @Mock
    private OpinionNodeMapper opinionNodeMapper;
    @Mock
    private UserMapper userMapper;
    @Mock
    private OpinionNodeStatsService statsService;
    @Mock
    private SensitiveWordFilter sensitiveWordFilter;
    @Mock
    private Authentication authentication;

    private OpinionNodeController controller;

    @BeforeEach
    void setUp() {
        controller = new OpinionNodeController(
                topicMapper,
                opinionNodeMapper,
                userMapper,
                statsService,
                sensitiveWordFilter
        );
    }

    @Test
    void replyDisagreeToDisagreeOpinionBecomesAgreeOnTopic() {
        User currentUser = user(2L, "reply-user");
        OpinionNode parent = opinion(10L, 1L, Stance.DISAGREE, Stance.DISAGREE);
        OpinionNodeStats newNodeStats = new OpinionNodeStats();
        newNodeStats.setOpinionId(100L);
        OpinionNodeCreateRequest request = request(10L, Stance.DISAGREE, null);

        when(authentication.isAuthenticated()).thenReturn(true);
        when(authentication.getName()).thenReturn("reply-user");
        when(userMapper.selectOne(any())).thenReturn(currentUser);
        when(topicMapper.selectById(1L)).thenReturn(new Topic());
        when(sensitiveWordFilter.containsSensitiveWord("I disagree with this reply")).thenReturn(false);
        when(opinionNodeMapper.selectById(10L)).thenReturn(parent);
        when(opinionNodeMapper.selectCount(any())).thenReturn(0L);
        when(opinionNodeMapper.insert(any(OpinionNode.class))).thenAnswer(invocation -> {
            OpinionNode node = invocation.getArgument(0);
            node.setId(100L);
            return 1;
        });
        when(statsService.initializeStats(100L)).thenReturn(newNodeStats);

        ResponseEntity<?> response = controller.create(1L, request, authentication);
        OpinionNodeResponse body = (OpinionNodeResponse) response.getBody();

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals(Stance.AGREE, body.getEffectiveTopicStance());
        assertFalse(body.getTopicStanceExplicit());
        verify(statsService).recordReply(parent, Stance.DISAGREE, 2L);
    }

    @Test
    void replyToNeutralBranchRequiresExplicitTopicStance() {
        User currentUser = user(2L, "reply-user");
        OpinionNode parent = opinion(10L, 1L, Stance.NEUTRAL, Stance.NEUTRAL);
        OpinionNodeCreateRequest request = request(10L, Stance.AGREE, null);

        when(authentication.isAuthenticated()).thenReturn(true);
        when(authentication.getName()).thenReturn("reply-user");
        when(userMapper.selectOne(any())).thenReturn(currentUser);
        when(topicMapper.selectById(1L)).thenReturn(new Topic());
        when(sensitiveWordFilter.containsSensitiveWord("I disagree with this reply")).thenReturn(false);
        when(opinionNodeMapper.selectById(10L)).thenReturn(parent);
        when(opinionNodeMapper.selectCount(any())).thenReturn(0L);

        ResponseEntity<?> response = controller.create(1L, request, authentication);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("topicStance is required when replying AGREE or DISAGREE to a neutral branch.", response.getBody());
        verify(opinionNodeMapper, never()).insert(any(OpinionNode.class));
    }

    private OpinionNodeCreateRequest request(Long parentId, Stance stance, Stance topicStance) {
        OpinionNodeCreateRequest request = new OpinionNodeCreateRequest();
        request.setParentId(parentId);
        request.setStance(stance);
        request.setTopicStance(topicStance);
        request.setContent("I disagree with this reply");
        return request;
    }

    private OpinionNode opinion(Long id, Long authorId, Stance stance, Stance effectiveTopicStance) {
        OpinionNode opinion = new OpinionNode();
        opinion.setId(id);
        opinion.setTopicId(1L);
        opinion.setAuthorId(authorId);
        opinion.setStance(stance);
        opinion.setEffectiveTopicStance(effectiveTopicStance);
        opinion.setTopicStanceExplicit(false);
        opinion.setFolded(false);
        return opinion;
    }

    private User user(Long id, String username) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setEnabled(true);
        user.setUserLevel(UserLevel.OFFICIAL);
        user.setReceivedLikeUserCount(0);
        return user;
    }
}
