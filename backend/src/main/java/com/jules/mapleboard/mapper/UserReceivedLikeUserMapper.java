package com.jules.mapleboard.mapper;

import com.jules.mapleboard.domain.UserReceivedLikeUser;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface UserReceivedLikeUserMapper {
    @Insert("""
            INSERT INTO user_received_like_users (author_id, liker_id)
            VALUES (#{authorId}, #{likerId})
            """)
    int insert(UserReceivedLikeUser likeUser);

    @Select("""
            SELECT COUNT(*)
            FROM user_received_like_users
            WHERE author_id = #{authorId}
              AND liker_id = #{likerId}
            """)
    long countByAuthorIdAndLikerId(@Param("authorId") Long authorId, @Param("likerId") Long likerId);
}
