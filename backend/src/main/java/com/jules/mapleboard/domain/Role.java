package com.jules.mapleboard.domain;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;


@Data
@TableName("roles")
public class Role {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String name; // ROLE_USER / ROLE_ADMIN
}