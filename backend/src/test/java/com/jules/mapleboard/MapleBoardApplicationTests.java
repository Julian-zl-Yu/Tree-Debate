package com.jules.mapleboard;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class MapleBoardApplicationTests {

    @Test
    void applicationClassExists() {
        // Keep this smoke test small so unit tests do not need a local MySQL database.
        assertNotNull(MapleBoardApplication.class);
    }

}
