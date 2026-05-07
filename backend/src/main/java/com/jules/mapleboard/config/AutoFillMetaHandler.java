package com.jules.mapleboard.config;

import com.baomidou.mybatisplus.core.handlers.MetaObjectHandler;
import org.apache.ibatis.reflection.MetaObject;
import org.springframework.stereotype.Component;


import java.time.LocalDateTime;


@Component
public class AutoFillMetaHandler implements MetaObjectHandler {
    @Override
    public void insertFill(MetaObject metaObject) {
        this.strictInsertFill(metaObject, "createdAt", LocalDateTime::now, LocalDateTime.class);
    }


    @Override
    public void updateFill(MetaObject metaObject) {
// 需要的话可以处理 updatedAt
    }
}