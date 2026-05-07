package com.jules.mapleboard.domain;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("user_received_like_users")
public class UserReceivedLikeUser {
    @TableField("author_id")
    private Long authorId;

    @TableField("liker_id")
    private Long likerId;
}
