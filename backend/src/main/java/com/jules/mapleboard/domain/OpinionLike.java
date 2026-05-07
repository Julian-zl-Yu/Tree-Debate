package com.jules.mapleboard.domain;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("opinion_likes")
public class OpinionLike {
    @TableField("opinion_id")
    private Long opinionId;

    @TableField("user_id")
    private Long userId;

    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
