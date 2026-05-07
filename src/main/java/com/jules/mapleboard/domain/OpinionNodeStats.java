package com.jules.mapleboard.domain;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("opinion_node_stats")
public class OpinionNodeStats {
    @TableId("opinion_id")
    private Long opinionId;

    @TableField("like_count")
    private Integer likeCount;

    @TableField("reply_count")
    private Integer replyCount;

    @TableField("unique_reply_user_count")
    private Integer uniqueReplyUserCount;

    @TableField("report_score_spam")
    private Double reportScoreSpam;

    @TableField("report_score_harassment")
    private Double reportScoreHarassment;

    @TableField("report_score_offtopic")
    private Double reportScoreOfftopic;

    @TableField("comment_weight")
    private Double commentWeight;

    @TableField("w_agree")
    private Double wAgree;

    @TableField("w_neutral")
    private Double wNeutral;

    @TableField("w_disagree")
    private Double wDisagree;

    @TableField("opinion_entropy")
    private Double opinionEntropy;

    @TableField("engagement_weight")
    private Double engagementWeight;

    @TableField("freshness_factor")
    private Double freshnessFactor;

    @TableField("final_score")
    private Double finalScore;

    @TableField("updated_at")
    private LocalDateTime updatedAt;
}
