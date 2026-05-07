package com.jules.mapleboard.service;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;

@Service
public class SensitiveWordFilter {
    private static final List<String> BLOCKED_TERMS = List.of(
            "spam",
            "scam",
            "fuck",
            "shit",
            "idiot",
            "傻逼",
            "垃圾",
            "操你"
    );

    public boolean containsSensitiveWord(String text) {
        if (!StringUtils.hasText(text)) {
            return false;
        }
        String normalized = text.toLowerCase(Locale.ROOT);
        return BLOCKED_TERMS.stream().anyMatch(normalized::contains);
    }
}
