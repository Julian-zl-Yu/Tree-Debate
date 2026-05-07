package com.jules.mapleboard.dto;

import com.jules.mapleboard.domain.Stance;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class OpinionNodeUpdateRequest {
    @NotNull
    private Stance stance;

    @NotBlank
    private String content;
}
