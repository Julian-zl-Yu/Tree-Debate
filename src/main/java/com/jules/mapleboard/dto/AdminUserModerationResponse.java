package com.jules.mapleboard.dto;

import com.jules.mapleboard.domain.UserLevel;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AdminUserModerationResponse {
    private Long id;
    private String username;
    private Boolean enabled;
    private UserLevel userLevel;
    private Integer receivedLikeUserCount;
    private LocalDateTime createdAt;
}
