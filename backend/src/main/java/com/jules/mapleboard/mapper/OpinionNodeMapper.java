package com.jules.mapleboard.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.jules.mapleboard.domain.OpinionNode;
import com.jules.mapleboard.dto.AdminReportedOpinionResponse;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface OpinionNodeMapper extends BaseMapper<OpinionNode> {
    @Select("""
            <script>
            SELECT
                o.id,
                o.topic_id AS topicId,
                t.title AS topicTitle,
                o.parent_id AS parentId,
                o.author_id AS authorId,
                u.username AS author,
                o.stance,
                o.effective_topic_stance AS effectiveTopicStance,
                o.topic_stance_explicit AS topicStanceExplicit,
                o.content,
                o.is_folded AS folded,
                o.created_at AS createdAt,
                o.updated_at AS updatedAt,
                s.like_count AS likeCount,
                s.reply_count AS replyCount,
                s.unique_reply_user_count AS uniqueReplyUserCount,
                s.report_score_spam AS reportScoreSpam,
                s.report_score_harassment AS reportScoreHarassment,
                s.report_score_offtopic AS reportScoreOfftopic,
                s.comment_weight AS commentWeight,
                s.w_agree AS wAgree,
                s.w_neutral AS wNeutral,
                s.w_disagree AS wDisagree,
                s.opinion_entropy AS opinionEntropy,
                s.engagement_weight AS engagementWeight,
                s.freshness_factor AS freshnessFactor,
                s.final_score AS finalScore
            FROM opinion_nodes o
            JOIN topics t ON t.id = o.topic_id
            JOIN users u ON u.id = o.author_id
            JOIN opinion_node_stats s ON s.opinion_id = o.id
            WHERE (
                s.report_score_spam > 0
                OR s.report_score_harassment > 0
                OR s.report_score_offtopic > 0
            )
            <if test="folded != null">
              AND o.is_folded = #{folded}
            </if>
            <choose>
              <when test="reportType == 'SPAM'">
                AND s.report_score_spam > 0
              </when>
              <when test="reportType == 'HARASSMENT'">
                AND s.report_score_harassment > 0
              </when>
              <when test="reportType == 'OFFTOPIC'">
                AND s.report_score_offtopic > 0
              </when>
            </choose>
            ORDER BY
                (s.report_score_spam + s.report_score_harassment + s.report_score_offtopic) DESC,
                o.created_at DESC
            </script>
            """)
    Page<AdminReportedOpinionResponse> selectReportedOpinions(Page<AdminReportedOpinionResponse> page,
                                                              @Param("folded") Boolean folded,
                                                              @Param("reportType") String reportType);
}
