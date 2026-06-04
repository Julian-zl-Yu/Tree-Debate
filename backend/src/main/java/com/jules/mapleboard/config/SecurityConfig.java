package com.jules.mapleboard.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableMethodSecurity(jsr250Enabled = true) // enables @PreAuthorize("hasRole('ADMIN')") etc.
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final UserDetailsService userDetailsService;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter, UserDetailsService userDetailsService) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.userDetailsService = userDetailsService;
    }

    // ====== Basics ======
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public DaoAuthenticationProvider authProvider() {
        DaoAuthenticationProvider p = new DaoAuthenticationProvider();
        p.setUserDetailsService(userDetailsService);
        p.setPasswordEncoder(passwordEncoder());
        return p;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration cfg) throws Exception {
        return cfg.getAuthenticationManager();
    }

//    // ====== CORS (works for Swagger + local HTML) ======
//    @Bean
//    public CorsConfigurationSource corsConfigurationSource() {
//        CorsConfiguration cfg = new CorsConfiguration();
//        // In production, replace "*" with your actual frontend origin(s)
//        cfg.setAllowedOriginPatterns(List.of("*"));
//        cfg.setAllowedMethods(List.of("GET","POST","PUT","DELETE","PATCH","OPTIONS"));
//        cfg.setAllowedHeaders(List.of("*"));
//        cfg.setAllowCredentials(false); // using Bearer tokens, not cookies
//        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
//        src.registerCorsConfiguration("/**", cfg);
//        return src;
//    }

    // ====== Main filter chain ======
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                           CorsConfigurationSource corsConfigurationSource) throws Exception {
        http
                .cors(c -> c.configurationSource(corsConfigurationSource))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // 根路径与常见静态/错误页
                        .requestMatchers("/", "/index.html", "/error", "/favicon.ico", "/assets/**", "/static/**").permitAll()

                        // Swagger 文档
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()

                        // 认证端点（注册/登录）
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/health", "/api/health/**").permitAll()

                        // 预检请求
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // 公共读取
                        .requestMatchers(HttpMethod.GET, "/api/topics/**").permitAll()

                        // 其它均需认证
                        .anyRequest().authenticated()
                )
                .exceptionHandling(ex -> ex
                        // 未登录访问受保护端点 → 401（更利于排错，不要默认 403）
                        .authenticationEntryPoint((req, res, e) -> res.setStatus(401))
                        // 已登录但无权限 → 403
                        .accessDeniedHandler((req, res, e) -> res.setStatus(403))
                )
                .authenticationProvider(authProvider())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

}
