package com.jules.mapleboard.dto;

import com.jules.mapleboard.domain.ReportType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class OpinionReportCreateRequest {
    @NotNull
    private ReportType reportType;

    @Size(max = 255)
    private String reason;
}
