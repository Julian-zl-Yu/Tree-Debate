package com.jules.mapleboard.domain;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;


@Data
@TableName("user_roles")
public class UserRole {
    @TableField("user_id")
    private Long userId;
    @TableField("role_id")
    private Long roleId;
}

