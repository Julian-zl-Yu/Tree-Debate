package com.jules.mapleboard.dto;

import com.jules.mapleboard.domain.ReportType;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class AdminOpinionReportResponse {
    private Long id;
    private Long opinionId;
    private Long reporterId;
    private String reporter;
    private ReportType reportType;
    private BigDecimal weight;
    private String reason;
    private LocalDateTime createdAt;
}
