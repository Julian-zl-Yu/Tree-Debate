package com.jules.mapleboard.dto;

import com.jules.mapleboard.domain.Stance;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class OpinionNodeCreateRequest {
    private Long parentId;

    @NotNull
    private Stance stance;

    private Stance topicStance;

    @NotBlank
    private String content;
}
