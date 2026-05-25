package com.jules.mapleboard.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SensitiveWordFilterTest {
    private final SensitiveWordFilter filter = new SensitiveWordFilter();

    @Test
    void detectsBlockedWordsIgnoringCase() {
        assertTrue(filter.containsSensitiveWord("This looks like a SCAM link."));
    }

    @Test
    void allowsNormalDiscussionText() {
        assertFalse(filter.containsSensitiveWord("I disagree, but here is my reason."));
    }

    @Test
    void treatsBlankTextAsSafe() {
        assertFalse(filter.containsSensitiveWord("   "));
    }
}
