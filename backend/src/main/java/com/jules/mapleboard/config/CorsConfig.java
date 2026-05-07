package com.jules.mapleboard.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
public class CorsConfig {

    @Value("${app.allowed-origins:}")
    private String allowedOrigins; // 逗号分隔的精确域名

    @Value("${app.allowed-origin-patterns:}")
    private String allowedOriginPatterns; // 逗号分隔的通配域名，如 https://*.vercel.app

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();

        // 1) 如果提供了通配，优先使用通配
        if (allowedOriginPatterns != null && !allowedOriginPatterns.isBlank()) {
            List<String> patterns = Arrays.stream(allowedOriginPatterns.split(","))
                    .map(String::trim).filter(s -> !s.isEmpty()).toList();
            cfg.setAllowedOriginPatterns(patterns);
            cfg.setAllowCredentials(false); // 使用通配时不能 true
        } else {
            // 2) 否则使用精确白名单
            List<String> origins = Arrays.stream(allowedOrigins.split(","))
                    .map(String::trim).filter(s -> !s.isEmpty()).toList();
            cfg.setAllowedOrigins(origins);
            // 你前后端用 Bearer Token 放在 Authorization 头里，不需要 cookie，保持 false 更安全
            cfg.setAllowCredentials(false);
        }

        cfg.setAllowedMethods(List.of("GET","POST","PUT","DELETE","PATCH","OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        // 如需在前端读自定义响应头可设置：cfg.setExposedHeaders(List.of("Authorization"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}
