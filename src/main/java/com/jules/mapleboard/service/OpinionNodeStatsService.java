package com.jules.mapleboard.service;

import com.jules.mapleboard.domain.OpinionNode;
import com.jules.mapleboard.domain.OpinionNodeStats;
import com.jules.mapleboard.domain.Stance;

import java.util.Collection;
import java.util.Map;

public interface OpinionNodeStatsService {
    OpinionNodeStats initializeStats(Long opinionId);

    OpinionNodeStats recordReply(OpinionNode parent, Stance replyStance);

    OpinionNodeStats recordLike(OpinionNode opinion, Long userId);

    Map<Long, OpinionNodeStats> listStats(Collection<Long> opinionIds);
}
