package com.jules.mapleboard.domain;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;


@Data
@TableName("users")
public class User {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String username;
    private String password;
    private Boolean enabled;
    @TableField("user_level")
    private UserLevel userLevel;
    @TableField("received_like_user_count")
    private Integer receivedLikeUserCount;
    @TableField("created_at")
    private LocalDateTime createdAt;
}
