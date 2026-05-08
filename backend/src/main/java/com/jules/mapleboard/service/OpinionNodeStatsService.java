package com.jules.mapleboard.service;

import com.jules.mapleboard.domain.OpinionNode;
import com.jules.mapleboard.domain.OpinionNodeStats;
import com.jules.mapleboard.domain.ReportType;
import com.jules.mapleboard.domain.Stance;
import com.jules.mapleboard.domain.User;

import java.util.Collection;
import java.util.Map;

public interface OpinionNodeStatsService {
    OpinionNodeStats initializeStats(Long opinionId);

    OpinionNodeStats recordReply(OpinionNode parent, Stance replyStance, Long userId);

    OpinionNodeStats recordLike(OpinionNode opinion, Long userId);

    OpinionNodeStats recordReport(OpinionNode opinion, User reporter, ReportType reportType, String reason);

    OpinionNodeStats deleteReport(Long reportId);

    OpinionNodeStats setFolded(OpinionNode opinion, boolean folded);

    Map<Long, OpinionNodeStats> listStats(Collection<Long> opinionIds);
}
