package com.jules.mapleboard.domain;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("opinion_reply_users")
public class OpinionReplyUser {
    @TableField("opinion_id")
    private Long opinionId;

    @TableField("user_id")
    private Long userId;
}
