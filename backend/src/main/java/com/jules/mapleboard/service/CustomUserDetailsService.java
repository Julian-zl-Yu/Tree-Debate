package com.jules.mapleboard.service;

import com.jules.mapleboard.domain.Role;
import com.jules.mapleboard.domain.User;
import com.jules.mapleboard.mapper.RoleMapper;
import com.jules.mapleboard.mapper.UserMapper;
import com.jules.mapleboard.mapper.UserRoleMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;


import java.util.*;


@Service
public class CustomUserDetailsService implements UserDetailsService {
    private final UserMapper userMapper;
    private final RoleMapper roleMapper;
    private final UserRoleMapper userRoleMapper;


    public CustomUserDetailsService(UserMapper userMapper, RoleMapper roleMapper, UserRoleMapper userRoleMapper) {
        this.userMapper = userMapper;
        this.roleMapper = roleMapper;
        this.userRoleMapper = userRoleMapper;
    }


    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getUsername, username));
        if (user == null || Boolean.FALSE.equals(user.getEnabled())) {
            throw new UsernameNotFoundException("User not found");
        }
// 查角色
        List<Long> roleIds = userRoleMapper.selectList(null).stream()
                .filter(ur -> Objects.equals(ur.getUserId(), user.getId()))
                .map(ur -> ur.getRoleId()).toList();
        List<Role> roles = roleIds.isEmpty() ? List.of() : roleMapper.selectBatchIds(roleIds);
        List<SimpleGrantedAuthority> auths = roles.stream()
                .map(r -> new SimpleGrantedAuthority(r.getName()))
                .toList();
        return org.springframework.security.core.userdetails.User
                .withUsername(user.getUsername())
                .password(user.getPassword())
                .authorities(auths)
                .accountLocked(false)
                .disabled(false)
                .build();
    }
}