package com.jules.mapleboard.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class TopicResponse {
    private Long id;
    private String category;
    private String title;
    private String content;
    private Long authorId;
    private String author;
    private LocalDateTime createdAt;
}
