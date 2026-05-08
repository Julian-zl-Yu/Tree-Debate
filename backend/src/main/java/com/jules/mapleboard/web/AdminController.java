package com.jules.mapleboard.web;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.jules.mapleboard.domain.OpinionNode;
import com.jules.mapleboard.domain.OpinionNodeStats;
import com.jules.mapleboard.domain.Topic;
import com.jules.mapleboard.domain.User;
import com.jules.mapleboard.dto.AdminOpinionReportResponse;
import com.jules.mapleboard.dto.AdminReportedOpinionResponse;
import com.jules.mapleboard.dto.AdminTopicResponse;
import com.jules.mapleboard.dto.AdminUserModerationResponse;
import com.jules.mapleboard.mapper.OpinionNodeMapper;
import com.jules.mapleboard.mapper.OpinionReportMapper;
import com.jules.mapleboard.mapper.TopicMapper;
import com.jules.mapleboard.mapper.UserMapper;
import com.jules.mapleboard.service.OpinionNodeStatsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin", description = "TreeDebate moderation")
@RestController
@RequestMapping("/api/admin")
@CrossOrigin
public class AdminController {
    private final OpinionNodeMapper opinionNodeMapper;
    private final OpinionReportMapper opinionReportMapper;
    private final TopicMapper topicMapper;
    private final UserMapper userMapper;
    private final OpinionNodeStatsService statsService;

    public AdminController(OpinionNodeMapper opinionNodeMapper,
                           OpinionReportMapper opinionReportMapper,
                           TopicMapper topicMapper,
                           UserMapper userMapper,
                           OpinionNodeStatsService statsService) {
        this.opinionNodeMapper = opinionNodeMapper;
        this.opinionReportMapper = opinionReportMapper;
        this.topicMapper = topicMapper;
        this.userMapper = userMapper;
        this.statsService = statsService;
    }

    @Operation(summary = "Review reported opinion nodes")
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/reported-opinions")
    public Page<AdminReportedOpinionResponse> reportedOpinions(@RequestParam(defaultValue = "0") int page,
                                                               @RequestParam(defaultValue = "20") int size,
                                                               @RequestParam(required = false) Boolean folded,
                                                               @RequestParam(required = false) String reportType) {
        if (size > 50) size = 50;
        String normalizedType = reportType == null ? null : reportType.trim().toUpperCase();
        return opinionNodeMapper.selectReportedOpinions(
                new Page<>(page + 1L, size),
                folded,
                normalizedType
        );
    }

    @Operation(summary = "Review topics with admin-only scoring data")
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/topics")
    public Page<AdminTopicResponse> topics(@RequestParam(defaultValue = "HOT") String sort,
                                           @RequestParam(required = false) String category,
                                           @RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "20") int size,
                                           @RequestParam(required = false) String keyword) {
        if (size > 50) size = 50;
        String normalizedSort = sort == null ? "HOT" : sort.trim().toUpperCase();
        return topicMapper.selectAdminTopics(new Page<>(page + 1L, size), normalizedSort, category, keyword);
    }

    @Operation(summary = "Delete a topic")
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/topics/{id}")
    public ResponseEntity<?> deleteTopic(@PathVariable Long id) {
        Topic topic = topicMapper.selectById(id);
        if (topic == null) {
            return ResponseEntity.notFound().build();
        }
        topicMapper.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "List reports for an opinion node")
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/opinions/{id}/reports")
    public ResponseEntity<?> opinionReports(@PathVariable Long id) {
        if (opinionNodeMapper.selectById(id) == null) {
            return ResponseEntity.notFound().build();
        }
        java.util.List<AdminOpinionReportResponse> reports = opinionReportMapper.selectByOpinionIdForAdmin(id);
        return ResponseEntity.ok(reports);
    }

    @Operation(summary = "Delete an individual report and recompute moderation scores")
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/reports/{id}")
    public ResponseEntity<?> deleteReport(@PathVariable Long id) {
        OpinionNodeStats stats = statsService.deleteReport(id);
        if (stats == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(stats);
    }

    @Operation(summary = "Manually fold an opinion node")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/opinions/{id}/fold")
    public ResponseEntity<?> foldOpinion(@PathVariable Long id) {
        return setFolded(id, true);
    }

    @Operation(summary = "Manually unfold an opinion node")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/opinions/{id}/unfold")
    public ResponseEntity<?> unfoldOpinion(@PathVariable Long id) {
        return setFolded(id, false);
    }

    @Operation(summary = "Ban a user")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/users/{id}/ban")
    public ResponseEntity<?> banUser(@PathVariable Long id) {
        return setUserEnabled(id, false);
    }

    @Operation(summary = "Unban a user")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/users/{id}/unban")
    public ResponseEntity<?> unbanUser(@PathVariable Long id) {
        return setUserEnabled(id, true);
    }

    private ResponseEntity<?> setFolded(Long id, boolean folded) {
        OpinionNode opinion = opinionNodeMapper.selectById(id);
        if (opinion == null) {
            return ResponseEntity.notFound().build();
        }
        OpinionNodeStats stats = statsService.setFolded(opinion, folded);
        return ResponseEntity.ok(stats);
    }

    private ResponseEntity<?> setUserEnabled(Long id, boolean enabled) {
        User user = userMapper.selectById(id);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        user.setEnabled(enabled);
        userMapper.updateById(user);
        return ResponseEntity.ok(toUserModerationResponse(user));
    }

    private AdminUserModerationResponse toUserModerationResponse(User user) {
        AdminUserModerationResponse response = new AdminUserModerationResponse();
        response.setId(user.getId());
        response.setUsername(user.getUsername());
        response.setEnabled(user.getEnabled());
        response.setUserLevel(user.getUserLevel());
        response.setReceivedLikeUserCount(user.getReceivedLikeUserCount());
        response.setCreatedAt(user.getCreatedAt());
        return response;
    }
}
