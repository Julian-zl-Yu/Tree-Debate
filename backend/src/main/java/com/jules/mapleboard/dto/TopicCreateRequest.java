package com.jules.mapleboard.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class TopicCreateRequest {
    @NotBlank
    @Size(max = 30)
    private String category;

    @NotBlank
    @Size(max = 150)
    private String title;

    @NotBlank
    private String content;
}
