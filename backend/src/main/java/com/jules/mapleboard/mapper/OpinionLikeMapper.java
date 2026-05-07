package com.jules.mapleboard.mapper;

import com.jules.mapleboard.domain.OpinionLike;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface OpinionLikeMapper {
    @Insert("""
            INSERT INTO opinion_likes (opinion_id, user_id)
            VALUES (#{opinionId}, #{userId})
            """)
    int insert(OpinionLike like);

    @Select("""
            SELECT COUNT(*)
            FROM opinion_likes
            WHERE opinion_id = #{opinionId}
              AND user_id = #{userId}
            """)
    long countByOpinionIdAndUserId(Long opinionId, Long userId);
}
