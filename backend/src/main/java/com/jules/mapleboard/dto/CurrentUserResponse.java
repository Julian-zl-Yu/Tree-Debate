package com.jules.mapleboard.dto;

import com.jules.mapleboard.domain.UserLevel;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class CurrentUserResponse {
    private Long id;
    private String username;
    private Boolean enabled;
    private UserLevel userLevel;
    private Integer receivedLikeUserCount;
    private LocalDateTime createdAt;
    private List<String> roles;
}
