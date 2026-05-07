package com.jules.mapleboard.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class TopicFeedResponse {
    private Long id;
    private String category;
    private String title;
    private String content;
    private Long authorId;
    private String author;
    private LocalDateTime createdAt;
    private Integer opinionCount;
    private Integer replyCount;
}
