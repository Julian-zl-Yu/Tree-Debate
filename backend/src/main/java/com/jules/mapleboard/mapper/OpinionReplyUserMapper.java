package com.jules.mapleboard.mapper;

import com.jules.mapleboard.domain.OpinionReplyUser;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface OpinionReplyUserMapper {
    @Insert("""
            INSERT INTO opinion_reply_users (opinion_id, user_id)
            VALUES (#{opinionId}, #{userId})
            """)
    int insert(OpinionReplyUser replyUser);

    @Select("""
            SELECT COUNT(*)
            FROM opinion_reply_users
            WHERE opinion_id = #{opinionId}
              AND user_id = #{userId}
            """)
    long countByOpinionIdAndUserId(@Param("opinionId") Long opinionId, @Param("userId") Long userId);
}
