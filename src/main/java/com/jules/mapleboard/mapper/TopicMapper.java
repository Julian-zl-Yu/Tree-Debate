package com.jules.mapleboard.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.jules.mapleboard.domain.Topic;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface TopicMapper extends BaseMapper<Topic> {
}
