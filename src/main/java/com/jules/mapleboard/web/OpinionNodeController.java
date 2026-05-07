package com.jules.mapleboard.web;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.jules.mapleboard.domain.OpinionNode;
import com.jules.mapleboard.domain.OpinionNodeStats;
import com.jules.mapleboard.domain.Topic;
import com.jules.mapleboard.domain.User;
import com.jules.mapleboard.dto.OpinionNodeCreateRequest;
import com.jules.mapleboard.dto.OpinionNodeResponse;
import com.jules.mapleboard.dto.OpinionNodeStatsResponse;
import com.jules.mapleboard.mapper.OpinionNodeMapper;
import com.jules.mapleboard.mapper.TopicMapper;
import com.jules.mapleboard.mapper.UserMapper;
import com.jules.mapleboard.service.OpinionNodeStatsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Tag(name = "Opinion Nodes", description = "TreeDebate opinion tree nodes")
@RestController
@RequestMapping("/api/topics/{topicId}/opinions")
@CrossOrigin
public class OpinionNodeController {
    private final TopicMapper topicMapper;
    private final OpinionNodeMapper opinionNodeMapper;
    private final UserMapper userMapper;
    private final OpinionNodeStatsService statsService;

    public OpinionNodeController(TopicMapper topicMapper,
                                 OpinionNodeMapper opinionNodeMapper,
                                 UserMapper userMapper,
                                 OpinionNodeStatsService statsService) {
        this.topicMapper = topicMapper;
        this.opinionNodeMapper = opinionNodeMapper;
        this.userMapper = userMapper;
        this.statsService = statsService;
    }

    @Operation(summary = "Get opinion tree for a topic")
    @GetMapping
    public ResponseEntity<?> listTree(@PathVariable Long topicId) {
        if (topicMapper.selectById(topicId) == null) {
            return ResponseEntity.notFound().build();
        }

        List<OpinionNode> nodes = opinionNodeMapper.selectList(new LambdaQueryWrapper<OpinionNode>()
                .eq(OpinionNode::getTopicId, topicId)
                .orderByAsc(OpinionNode::getCreatedAt));

        Map<Long, User> usersById = loadUsers(nodes.stream()
                .map(OpinionNode::getAuthorId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));
        Map<Long, OpinionNodeStats> statsByOpinionId = statsService.listStats(nodes.stream()
                .map(OpinionNode::getId)
                .collect(Collectors.toSet()));

        return ResponseEntity.ok(toTree(nodes, usersById, statsByOpinionId));
    }

    @Operation(summary = "Create opinion node")
    @PostMapping
    public ResponseEntity<?> create(@PathVariable Long topicId,
                                    @Valid @RequestBody OpinionNodeCreateRequest dto,
                                    Authentication authentication) {
        User currentUser = currentUser(authentication);
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Topic topic = topicMapper.selectById(topicId);
        if (topic == null) {
            return ResponseEntity.notFound().build();
        }

        OpinionNode parent = null;
        if (dto.getParentId() != null) {
            parent = opinionNodeMapper.selectById(dto.getParentId());
            if (parent == null || !topicId.equals(parent.getTopicId())) {
                return ResponseEntity.badRequest().body("parentId must belong to the same topic.");
            }
        }

        OpinionNode node = new OpinionNode();
        node.setTopicId(topicId);
        node.setParentId(dto.getParentId());
        node.setAuthorId(currentUser.getId());
        node.setStance(dto.getStance());
        node.setContent(dto.getContent());
        node.setFolded(false);
        opinionNodeMapper.insert(node);
        OpinionNodeStats nodeStats = statsService.initializeStats(node.getId());
        if (parent != null) {
            statsService.recordReply(parent, dto.getStance());
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(node, currentUser, nodeStats));
    }

    @Operation(summary = "Like opinion node")
    @PostMapping("/{opinionId}/likes")
    public ResponseEntity<?> like(@PathVariable Long topicId,
                                  @PathVariable Long opinionId,
                                  Authentication authentication) {
        User currentUser = currentUser(authentication);
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        OpinionNode opinion = opinionNodeMapper.selectById(opinionId);
        if (opinion == null || !topicId.equals(opinion.getTopicId())) {
            return ResponseEntity.notFound().build();
        }

        OpinionNodeStats stats = statsService.recordLike(opinion, currentUser.getId());
        return ResponseEntity.ok(toStatsResponse(stats));
    }

    private User currentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        return userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getUsername, authentication.getName()));
    }

    private Map<Long, User> loadUsers(Iterable<Long> userIds) {
        List<Long> ids = new ArrayList<>();
        userIds.forEach(ids::add);
        if (ids.isEmpty()) {
            return Collections.emptyMap();
        }
        return userMapper.selectBatchIds(ids).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
    }

    // build N-ary tree from flat list using parent_id
    private List<OpinionNodeResponse> toTree(List<OpinionNode> nodes,
                                             Map<Long, User> usersById,
                                             Map<Long, OpinionNodeStats> statsByOpinionId) {
        Map<Long, OpinionNodeResponse> byId = new LinkedHashMap<>();
        for (OpinionNode node : nodes) {
            byId.put(node.getId(), toResponse(node, usersById.get(node.getAuthorId()),
                    statsByOpinionId.get(node.getId())));
        }

        List<OpinionNodeResponse> roots = new ArrayList<>();
        for (OpinionNodeResponse node : byId.values()) {
            if (node.getParentId() == null || !byId.containsKey(node.getParentId())) {
                roots.add(node);
            } else {
                byId.get(node.getParentId()).getChildren().add(node);
            }
        }
        sortByScore(roots);
        return roots;
    }

    private void sortByScore(List<OpinionNodeResponse> nodes) {
        nodes.sort((left, right) -> {
            int scoreCompare = Double.compare(finalScore(right), finalScore(left));
            if (scoreCompare != 0) {
                return scoreCompare;
            }
            if (left.getCreatedAt() == null || right.getCreatedAt() == null) {
                return 0;
            }
            return left.getCreatedAt().compareTo(right.getCreatedAt());
        });
        nodes.forEach(node -> sortByScore(node.getChildren()));
    }

    private double finalScore(OpinionNodeResponse node) {
        return node.getStats() == null || node.getStats().getFinalScore() == null
                ? 0.0
                : node.getStats().getFinalScore();
    }

    private OpinionNodeResponse toResponse(OpinionNode node, User author, OpinionNodeStats stats) {
        OpinionNodeResponse response = new OpinionNodeResponse();
        response.setId(node.getId());
        response.setTopicId(node.getTopicId());
        response.setParentId(node.getParentId());
        response.setAuthorId(node.getAuthorId());
        response.setAuthor(author == null ? null : author.getUsername());
        response.setStance(node.getStance());
        response.setContent(node.getContent());
        response.setFolded(node.getFolded());
        response.setCreatedAt(node.getCreatedAt());
        response.setUpdatedAt(node.getUpdatedAt());
        response.setStats(toStatsResponse(stats));
        return response;
    }

    private OpinionNodeStatsResponse toStatsResponse(OpinionNodeStats stats) {
        if (stats == null) {
            return null;
        }
        OpinionNodeStatsResponse response = new OpinionNodeStatsResponse();
        response.setOpinionId(stats.getOpinionId());
        response.setLikeCount(stats.getLikeCount());
        response.setReplyCount(stats.getReplyCount());
        response.setUniqueReplyUserCount(stats.getUniqueReplyUserCount());
        response.setWAgree(stats.getWAgree());
        response.setWNeutral(stats.getWNeutral());
        response.setWDisagree(stats.getWDisagree());
        response.setOpinionEntropy(stats.getOpinionEntropy());
        response.setEngagementWeight(stats.getEngagementWeight());
        response.setFreshnessFactor(stats.getFreshnessFactor());
        response.setFinalScore(stats.getFinalScore());
        return response;
    }
}
