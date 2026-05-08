package com.jules.mapleboard.web;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.jules.mapleboard.domain.Role;
import com.jules.mapleboard.domain.User;
import com.jules.mapleboard.domain.UserRole;
import com.jules.mapleboard.dto.CurrentUserResponse;
import com.jules.mapleboard.mapper.RoleMapper;
import com.jules.mapleboard.mapper.UserMapper;
import com.jules.mapleboard.mapper.UserRoleMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Objects;

@Tag(name = "Users", description = "Current user")
@RestController
@RequestMapping("/api/users")
@CrossOrigin
public class UserController {
    private final UserMapper userMapper;
    private final UserRoleMapper userRoleMapper;
    private final RoleMapper roleMapper;

    public UserController(UserMapper userMapper, UserRoleMapper userRoleMapper, RoleMapper roleMapper) {
        this.userMapper = userMapper;
        this.userRoleMapper = userRoleMapper;
        this.roleMapper = roleMapper;
    }

    @Operation(summary = "Current user")
    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        User user = userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getUsername, authentication.getName()));
        if (user == null || Boolean.FALSE.equals(user.getEnabled())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        List<Long> roleIds = userRoleMapper.selectList(new LambdaQueryWrapper<UserRole>()
                        .eq(UserRole::getUserId, user.getId()))
                .stream()
                .map(UserRole::getRoleId)
                .toList();
        List<String> roles = roleIds.isEmpty()
                ? List.of()
                : roleMapper.selectBatchIds(roleIds).stream().map(Role::getName).toList();

        CurrentUserResponse response = new CurrentUserResponse();
        response.setId(user.getId());
        response.setUsername(user.getUsername());
        response.setEnabled(user.getEnabled());
        response.setUserLevel(user.getUserLevel());
        response.setReceivedLikeUserCount(user.getReceivedLikeUserCount());
        response.setCreatedAt(user.getCreatedAt());
        response.setRoles(roles);
        return ResponseEntity.ok(response);
    }
}
