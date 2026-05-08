package com.jules.mapleboard.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
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
    private Stance effectiveTopicStance;
    private Boolean topicStanceExplicit;
    private String content;
    private Boolean folded;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    @JsonIgnore
    private OpinionNodeStatsResponse stats;
    private List<OpinionNodeResponse> children = new ArrayList<>();
}
