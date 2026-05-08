package com.jules.mapleboard.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.jules.mapleboard.domain.Topic;
import com.jules.mapleboard.dto.AdminTopicResponse;
import com.jules.mapleboard.dto.TopicFeedResponse;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface TopicMapper extends BaseMapper<Topic> {
    @Select("""
            <script>
            SELECT
                t.id,
                t.category,
                t.title,
                t.content,
                t.author_id AS authorId,
                u.username AS author,
                t.created_at AS createdAt,
                COALESCE(tm.opinionCount, 0) AS opinionCount,
                COALESCE(tm.replyCount, 0) AS replyCount,
                COALESCE(tm.opinionEntropy, 0) AS opinionEntropy,
                COALESCE(tm.engagementWeight, 1) AS engagementWeight,
                GREATEST(0.3, 1.0 / (TIMESTAMPDIFF(HOUR, t.created_at, NOW()) / 24.0 + 1.0)) AS freshnessFactor,
                COALESCE(tm.opinionEntropy, 0)
                    * COALESCE(tm.engagementWeight, 1)
                    * GREATEST(0.3, 1.0 / (TIMESTAMPDIFF(HOUR, t.created_at, NOW()) / 24.0 + 1.0)) AS finalScore
            FROM topics t
            JOIN users u ON u.id = t.author_id
            LEFT JOIN (
                SELECT
                    weights.topic_id,
                    weights.opinionCount,
                    weights.replyCount,
                    CASE
                        WHEN weights.wAgree &lt;= 0 OR weights.wDisagree &lt;= 0 THEN 0
                        ELSE -(
                            (weights.wAgree / (weights.wAgree + weights.wDisagree))
                                * LN(weights.wAgree / (weights.wAgree + weights.wDisagree))
                            + (weights.wDisagree / (weights.wAgree + weights.wDisagree))
                                * LN(weights.wDisagree / (weights.wAgree + weights.wDisagree))
                        )
                    END AS opinionEntropy,
                    1 + LN(weights.wAgree + weights.wNeutral + weights.wDisagree + 1) AS engagementWeight
                FROM (
                    SELECT
                        o.topic_id,
                        COUNT(o.id) AS opinionCount,
                        COALESCE(SUM(CASE WHEN o.parent_id IS NULL THEN 0 ELSE 1 END), 0) AS replyCount,
                        COALESCE(SUM(CASE
                            WHEN o.effective_topic_stance = 'AGREE'
                                THEN CASE WHEN o.is_folded = 1 THEN 0 ELSE COALESCE(s.comment_weight, 1) END
                            ELSE 0
                        END), 0) AS wAgree,
                        COALESCE(SUM(CASE
                            WHEN o.effective_topic_stance = 'NEUTRAL'
                                THEN CASE WHEN o.is_folded = 1 THEN 0 ELSE COALESCE(s.comment_weight, 1) END
                            ELSE 0
                        END), 0) AS wNeutral,
                        COALESCE(SUM(CASE
                            WHEN o.effective_topic_stance = 'DISAGREE'
                                THEN CASE WHEN o.is_folded = 1 THEN 0 ELSE COALESCE(s.comment_weight, 1) END
                            ELSE 0
                        END), 0) AS wDisagree
                    FROM opinion_nodes o
                    LEFT JOIN opinion_node_stats s ON s.opinion_id = o.id
                    GROUP BY o.topic_id
                ) weights
            ) tm ON tm.topic_id = t.id
            WHERE 1 = 1
            <if test="category != null and category != ''">
              AND t.category = #{category}
            </if>
            <if test="keyword != null and keyword != ''">
              AND t.title LIKE CONCAT('%', #{keyword}, '%')
            </if>
            <choose>
              <when test="sort == 'NEW'">
                ORDER BY t.created_at DESC
              </when>
              <when test="sort == 'CONTROVERSIAL'">
                ORDER BY opinionEntropy DESC, finalScore DESC, t.created_at DESC
              </when>
              <otherwise>
                ORDER BY finalScore DESC, t.created_at DESC
              </otherwise>
            </choose>
            </script>
            """)
    Page<TopicFeedResponse> selectFeed(Page<TopicFeedResponse> page,
                                       @Param("sort") String sort,
                                       @Param("category") String category,
                                       @Param("keyword") String keyword);

    @Select("""
            <script>
            SELECT
                t.id,
                t.category,
                t.title,
                t.content,
                t.author_id AS authorId,
                u.username AS author,
                t.created_at AS createdAt,
                COALESCE(tm.opinionCount, 0) AS opinionCount,
                COALESCE(tm.replyCount, 0) AS replyCount,
                COALESCE(tm.foldedOpinionCount, 0) AS foldedOpinionCount,
                COALESCE(tm.reportedOpinionCount, 0) AS reportedOpinionCount,
                COALESCE(tm.opinionEntropy, 0) AS opinionEntropy,
                COALESCE(tm.engagementWeight, 1) AS engagementWeight,
                GREATEST(0.3, 1.0 / (TIMESTAMPDIFF(HOUR, t.created_at, NOW()) / 24.0 + 1.0)) AS freshnessFactor,
                COALESCE(tm.opinionEntropy, 0)
                    * COALESCE(tm.engagementWeight, 1)
                    * GREATEST(0.3, 1.0 / (TIMESTAMPDIFF(HOUR, t.created_at, NOW()) / 24.0 + 1.0)) AS finalScore
            FROM topics t
            JOIN users u ON u.id = t.author_id
            LEFT JOIN (
                SELECT
                    weights.topic_id,
                    weights.opinionCount,
                    weights.replyCount,
                    weights.foldedOpinionCount,
                    weights.reportedOpinionCount,
                    CASE
                        WHEN weights.wAgree &lt;= 0 OR weights.wDisagree &lt;= 0 THEN 0
                        ELSE -(
                            (weights.wAgree / (weights.wAgree + weights.wDisagree))
                                * LN(weights.wAgree / (weights.wAgree + weights.wDisagree))
                            + (weights.wDisagree / (weights.wAgree + weights.wDisagree))
                                * LN(weights.wDisagree / (weights.wAgree + weights.wDisagree))
                        )
                    END AS opinionEntropy,
                    1 + LN(weights.wAgree + weights.wNeutral + weights.wDisagree + 1) AS engagementWeight
                FROM (
                    SELECT
                        o.topic_id,
                        COUNT(o.id) AS opinionCount,
                        COALESCE(SUM(CASE WHEN o.parent_id IS NULL THEN 0 ELSE 1 END), 0) AS replyCount,
                        COALESCE(SUM(CASE WHEN o.is_folded = 1 THEN 1 ELSE 0 END), 0) AS foldedOpinionCount,
                        COALESCE(SUM(CASE
                            WHEN s.report_score_spam > 0
                              OR s.report_score_harassment > 0
                              OR s.report_score_offtopic > 0 THEN 1
                            ELSE 0
                        END), 0) AS reportedOpinionCount,
                        COALESCE(SUM(CASE
                            WHEN o.effective_topic_stance = 'AGREE'
                                THEN CASE WHEN o.is_folded = 1 THEN 0 ELSE COALESCE(s.comment_weight, 1) END
                            ELSE 0
                        END), 0) AS wAgree,
                        COALESCE(SUM(CASE
                            WHEN o.effective_topic_stance = 'NEUTRAL'
                                THEN CASE WHEN o.is_folded = 1 THEN 0 ELSE COALESCE(s.comment_weight, 1) END
                            ELSE 0
                        END), 0) AS wNeutral,
                        COALESCE(SUM(CASE
                            WHEN o.effective_topic_stance = 'DISAGREE'
                                THEN CASE WHEN o.is_folded = 1 THEN 0 ELSE COALESCE(s.comment_weight, 1) END
                            ELSE 0
                        END), 0) AS wDisagree
                    FROM opinion_nodes o
                    LEFT JOIN opinion_node_stats s ON s.opinion_id = o.id
                    GROUP BY o.topic_id
                ) weights
            ) tm ON tm.topic_id = t.id
            WHERE 1 = 1
            <if test="category != null and category != ''">
              AND t.category = #{category}
            </if>
            <if test="keyword != null and keyword != ''">
              AND (
                t.title LIKE CONCAT('%', #{keyword}, '%')
                OR t.content LIKE CONCAT('%', #{keyword}, '%')
              )
            </if>
            <choose>
              <when test="sort == 'NEW'">
                ORDER BY t.created_at DESC
              </when>
              <when test="sort == 'CONTROVERSIAL'">
                ORDER BY opinionEntropy DESC, finalScore DESC, t.created_at DESC
              </when>
              <otherwise>
                ORDER BY finalScore DESC, t.created_at DESC
              </otherwise>
            </choose>
            </script>
            """)
    Page<AdminTopicResponse> selectAdminTopics(Page<AdminTopicResponse> page,
                                               @Param("sort") String sort,
                                               @Param("category") String category,
                                               @Param("keyword") String keyword);
}
