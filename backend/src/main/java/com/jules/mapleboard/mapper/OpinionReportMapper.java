package com.jules.mapleboard.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.jules.mapleboard.domain.OpinionReport;
import com.jules.mapleboard.dto.AdminOpinionReportResponse;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface OpinionReportMapper extends BaseMapper<OpinionReport> {
    @Select("""
            SELECT
                r.id,
                r.opinion_id AS opinionId,
                r.reporter_id AS reporterId,
                u.username AS reporter,
                r.report_type AS reportType,
                r.weight,
                r.reason,
                r.created_at AS createdAt
            FROM opinion_reports r
            JOIN users u ON u.id = r.reporter_id
            WHERE r.opinion_id = #{opinionId}
            ORDER BY r.created_at DESC, r.id DESC
            """)
    List<AdminOpinionReportResponse> selectByOpinionIdForAdmin(@Param("opinionId") Long opinionId);
}
