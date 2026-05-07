package com.jules.mapleboard.dto;

import com.jules.mapleboard.domain.Stance;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AdminReportedOpinionResponse {
    private Long id;
    private Long topicId;
    private String topicTitle;
    private Long parentId;
    private Long authorId;
    private String author;
    private Stance stance;
    private String content;
    private Boolean folded;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private Integer likeCount;
    private Integer replyCount;
    private Integer uniqueReplyUserCount;
    private Double reportScoreSpam;
    private Double reportScoreHarassment;
    private Double reportScoreOfftopic;
    private Double commentWeight;
    private Double wAgree;
    private Double wNeutral;
    private Double wDisagree;
    private Double opinionEntropy;
    private Double engagementWeight;
    private Double freshnessFactor;
    private Double finalScore;
}
