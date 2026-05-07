package com.jules.mapleboard.web;

import com.jules.mapleboard.domain.OpinionNode;
import com.jules.mapleboard.domain.OpinionNodeStats;
import com.jules.mapleboard.mapper.OpinionNodeMapper;
import com.jules.mapleboard.service.OpinionNodeStatsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin", description = "TreeDebate moderation")
@RestController
@RequestMapping("/api/admin")
@CrossOrigin
public class AdminController {
    private final OpinionNodeMapper opinionNodeMapper;
    private final OpinionNodeStatsService statsService;

    public AdminController(OpinionNodeMapper opinionNodeMapper, OpinionNodeStatsService statsService) {
        this.opinionNodeMapper = opinionNodeMapper;
        this.statsService = statsService;
    }

    @Operation(summary = "Manually fold an opinion node")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/opinions/{id}/fold")
    public ResponseEntity<?> foldOpinion(@PathVariable Long id) {
        return setFolded(id, true);
    }

    @Operation(summary = "Manually unfold an opinion node")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/opinions/{id}/unfold")
    public ResponseEntity<?> unfoldOpinion(@PathVariable Long id) {
        return setFolded(id, false);
    }

    private ResponseEntity<?> setFolded(Long id, boolean folded) {
        OpinionNode opinion = opinionNodeMapper.selectById(id);
        if (opinion == null) {
            return ResponseEntity.notFound().build();
        }
        OpinionNodeStats stats = statsService.setFolded(opinion, folded);
        return ResponseEntity.ok(stats);
    }
}
