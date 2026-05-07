package com.jules.mapleboard.dto;

import jakarta.validation.constraints.*;
import lombok.Data;


@Data
public class LoginRequest {
    @NotBlank
    private String username;
    @NotBlank
    private String password;
}