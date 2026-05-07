package com.jules.mapleboard.web;

import com.jules.mapleboard.domain.Role;
import com.jules.mapleboard.domain.User;
import com.jules.mapleboard.domain.UserRole;
import com.jules.mapleboard.dto.AuthResponse;
import com.jules.mapleboard.dto.LoginRequest;
import com.jules.mapleboard.dto.RegisterRequest;
import com.jules.mapleboard.mapper.RoleMapper;
import com.jules.mapleboard.mapper.UserMapper;
import com.jules.mapleboard.mapper.UserRoleMapper;
import com.jules.mapleboard.config.JwtUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.annotation.security.PermitAll;
import jakarta.validation.Valid;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;


@Tag(name = "Auth", description = "注册/登录/当前用户")
@RestController
@RequestMapping("/api/auth")
@CrossOrigin
public class AuthController {
    private final UserMapper userMapper;
    private final RoleMapper roleMapper;
    private final UserRoleMapper userRoleMapper;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;


    public AuthController(UserMapper userMapper, RoleMapper roleMapper, UserRoleMapper userRoleMapper,
                          PasswordEncoder passwordEncoder, AuthenticationManager authenticationManager, JwtUtil jwtUtil) {
        this.userMapper = userMapper;
        this.roleMapper = roleMapper;
        this.userRoleMapper = userRoleMapper;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtUtil = jwtUtil;
    }

    @PermitAll
    @Operation(summary = "注册新用户（默认ROLE_USER）")
    @PostMapping("/register")
    public String register(@Valid @RequestBody RegisterRequest req) {
        if (userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getUsername, req.getUsername())) != null) {
            throw new IllegalArgumentException("username exists");
        }
        User u = new User();
        u.setUsername(req.getUsername());
        u.setPassword(passwordEncoder.encode(req.getPassword()));
        u.setEnabled(true);
        userMapper.insert(u);
        Role userRole = roleMapper.selectOne(new LambdaQueryWrapper<Role>().eq(Role::getName, "ROLE_USER"));
        if (userRole != null) {
            UserRole ur = new UserRole();
            ur.setUserId(u.getId());
            ur.setRoleId(userRole.getId());
            userRoleMapper.insert(ur);
        }
        return "ok";
    }

    @PermitAll
    @Operation(summary = "登录，返回JWT")
    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        try {
            Authentication auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(req.getUsername(), req.getPassword())
            );
            SecurityContextHolder.getContext().setAuthentication(auth);
            String token = jwtUtil.generate(req.getUsername());
            return new AuthResponse(token);
        } catch (org.springframework.security.core.AuthenticationException ex) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.UNAUTHORIZED, "Bad credentials"
            );
        }
    }
}