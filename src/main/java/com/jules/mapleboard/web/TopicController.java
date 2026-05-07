package com.jules.mapleboard.web;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.jules.mapleboard.domain.Topic;
import com.jules.mapleboard.domain.User;
import com.jules.mapleboard.dto.TopicCreateRequest;
import com.jules.mapleboard.dto.TopicResponse;
import com.jules.mapleboard.mapper.TopicMapper;
import com.jules.mapleboard.mapper.UserMapper;
import com.jules.mapleboard.service.SensitiveWordFilter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Tag(name = "Topics", description = "TreeDebate topics")
@RestController
@RequestMapping("/api/topics")
@CrossOrigin
public class TopicController {
    private final TopicMapper topicMapper;
    private final UserMapper userMapper;
    private final SensitiveWordFilter sensitiveWordFilter;

    public TopicController(TopicMapper topicMapper, UserMapper userMapper, SensitiveWordFilter sensitiveWordFilter) {
        this.topicMapper = topicMapper;
        this.userMapper = userMapper;
        this.sensitiveWordFilter = sensitiveWordFilter;
    }

    @Operation(summary = "List topics")
    @GetMapping
    public Page<TopicResponse> list(@RequestParam(required = false) String category,
                                    @RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "10") int size,
                                    @RequestParam(required = false) String keyword) {
        // pagination
        if (size > 50) size = 50;
        Page<Topic> topicPage = new Page<>(page + 1L, size);

        // Build query
        LambdaQueryWrapper<Topic> query = new LambdaQueryWrapper<Topic>()
                .orderByDesc(Topic::getCreatedAt);

        if (StringUtils.hasText(category)) {
            query.eq(Topic::getCategory, category);
        }
        if (StringUtils.hasText(keyword)) {
            query.like(Topic::getTitle, keyword);
        }

        // Execute DB query
        Page<Topic> result = topicMapper.selectPage(topicPage, query);

        // Batch load all authors to avoid N+1 query problem
        Map<Long, User> usersById = loadUsers(result.getRecords().stream()
                .map(Topic::getAuthorId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));

        // DB model -> response DTO
        Page<TopicResponse> response = new Page<>(result.getCurrent(), result.getSize(), result.getTotal());

        response.setRecords(result.getRecords().stream()
                .map(topic -> toResponse(topic, usersById.get(topic.getAuthorId())))
                .toList());
        return response;
    }

    @Operation(summary = "Create topic")
    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody TopicCreateRequest dto,
                                    Authentication authentication) {
        User currentUser = currentUser(authentication);

        if (currentUser == null) { // reject if not logged in
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (sensitiveWordFilter.containsSensitiveWord(dto.getTitle())
                || sensitiveWordFilter.containsSensitiveWord(dto.getContent())) {
            return ResponseEntity.badRequest().body("Topic contains sensitive words.");
        }

        //create new topic entity
        Topic topic = new Topic();
        topic.setCategory(dto.getCategory());
        topic.setTitle(dto.getTitle());
        topic.setContent(dto.getContent());
        topic.setAuthorId(currentUser.getId());
        //insert into DB
        topicMapper.insert(topic);

        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(topic, currentUser));
    }

    @Operation(summary = "Get topic")
    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable Long id) {
        Topic topic = topicMapper.selectById(id);

        if (topic == null) {
            return ResponseEntity.notFound().build();
        }

        User author = topic.getAuthorId() == null ? null : userMapper.selectById(topic.getAuthorId());
        return ResponseEntity.ok(toResponse(topic, author));
    }


    // Resolve current logged-in user from Spring Security context
    private User currentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        return userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getUsername, authentication.getName()));
    }

    // Batch load users to avoid repeated DB queries
    private Map<Long, User> loadUsers(Iterable<Long> userIds) {
        java.util.List<Long> ids = new java.util.ArrayList<>();
        userIds.forEach(ids::add);
        if (ids.isEmpty()) {
            return Collections.emptyMap();
        }
        return userMapper.selectBatchIds(ids).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
    }

    // Topic -> API response object
    private TopicResponse toResponse(Topic topic, User author) {
        TopicResponse response = new TopicResponse();
        response.setId(topic.getId());
        response.setCategory(topic.getCategory());
        response.setTitle(topic.getTitle());
        response.setContent(topic.getContent());
        response.setAuthorId(topic.getAuthorId());
        response.setAuthor(author == null ? null : author.getUsername());
        response.setCreatedAt(topic.getCreatedAt());
        return response;
    }
}
