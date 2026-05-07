package com.jules.mapleboard.domain;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("opinion_reports")
public class OpinionReport {
    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("opinion_id")
    private Long opinionId;

    @TableField("reporter_id")
    private Long reporterId;

    @TableField("report_type")
    private ReportType reportType;

    private BigDecimal weight;
    private String reason;

    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
