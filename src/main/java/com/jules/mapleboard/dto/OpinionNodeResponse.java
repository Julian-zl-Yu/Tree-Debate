package com.jules.mapleboard.dto;

import com.jules.mapleboard.domain.Stance;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class OpinionNodeResponse {
    private Long id;
    private Long topicId;
    private Long parentId;
    private Long authorId;
    private String author;
    private Stance stance;
    private String content;
    private Boolean folded;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<OpinionNodeResponse> children = new ArrayList<>();
}
