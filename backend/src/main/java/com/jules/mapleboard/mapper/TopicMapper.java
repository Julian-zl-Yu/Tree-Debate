package com.jules.mapleboard.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.jules.mapleboard.domain.Topic;
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
                COUNT(o.id) AS opinionCount,
                COALESCE(SUM(CASE WHEN o.parent_id IS NULL THEN 0 ELSE 1 END), 0) AS replyCount
            FROM topics t
            JOIN users u ON u.id = t.author_id
            LEFT JOIN opinion_nodes o ON o.topic_id = t.id
            LEFT JOIN opinion_node_stats s ON s.opinion_id = o.id
            WHERE 1 = 1
            <if test="category != null and category != ''">
              AND t.category = #{category}
            </if>
            <if test="keyword != null and keyword != ''">
              AND t.title LIKE CONCAT('%', #{keyword}, '%')
            </if>
            GROUP BY t.id, t.category, t.title, t.content, t.author_id, u.username, t.created_at
            <choose>
              <when test="sort == 'NEW'">
                ORDER BY t.created_at DESC
              </when>
              <when test="sort == 'CONTROVERSIAL'">
                ORDER BY COALESCE(MAX(s.opinion_entropy), 0) DESC,
                         COALESCE(MAX(s.final_score), 0) DESC,
                         t.created_at DESC
              </when>
              <otherwise>
                ORDER BY COALESCE(MAX(s.final_score), 0) DESC,
                         t.created_at DESC
              </otherwise>
            </choose>
            </script>
            """)
    Page<TopicFeedResponse> selectFeed(Page<TopicFeedResponse> page,
                                       @Param("sort") String sort,
                                       @Param("category") String category,
                                       @Param("keyword") String keyword);
}
