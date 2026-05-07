package com.jules.mapleboard.domain;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("opinion_nodes")
public class OpinionNode {
    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("topic_id")
    private Long topicId;

    @TableField("parent_id")
    private Long parentId;

    @TableField("author_id")
    private Long authorId;

    @TableField(exist = false)
    private String author;

    private Stance stance;
    private String content;

    @TableField("is_folded")
    private Boolean folded;

    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField("updated_at")
    private LocalDateTime updatedAt;
}
