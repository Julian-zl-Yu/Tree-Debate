package com.jules.mapleboard.dto;

import jakarta.validation.constraints.*;
import lombok.Data;


@Data
public class RegisterRequest {
    @NotBlank
    @Size(min = 3, max = 32)
    private String username;


    @NotBlank
    @Size(min = 6, max = 64)
    private String password;
}