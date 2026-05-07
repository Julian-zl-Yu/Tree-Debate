package com.jules.mapleboard.dto;

import lombok.Data;

@Data
public class OpinionNodeStatsResponse {
    private Long opinionId;
    private Integer likeCount;
    private Integer replyCount;
    private Integer uniqueReplyUserCount;
    private Double wAgree;
    private Double wNeutral;
    private Double wDisagree;
    private Double opinionEntropy;
    private Double engagementWeight;
    private Double freshnessFactor;
    private Double finalScore;
}
