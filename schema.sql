-- 1. USERS
CREATE TABLE users (
                       id BIGINT PRIMARY KEY AUTO_INCREMENT,
                       username VARCHAR(60) NOT NULL UNIQUE,
                       password VARCHAR(100) NOT NULL,
                       enabled TINYINT(1) NOT NULL DEFAULT 1,

                       user_level ENUM('NEW', 'OFFICIAL', 'REPUTABLE', 'ADMIN') NOT NULL DEFAULT 'NEW',
                       received_like_user_count INT NOT NULL DEFAULT 0,

                       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 2. ROLES
CREATE TABLE roles (
                       id BIGINT PRIMARY KEY AUTO_INCREMENT,
                       name VARCHAR(60) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE user_roles (
                            user_id BIGINT NOT NULL,
                            role_id BIGINT NOT NULL,

                            PRIMARY KEY (user_id, role_id),

                            CONSTRAINT fk_ur_user
                                FOREIGN KEY (user_id) REFERENCES users(id)
                                    ON DELETE CASCADE,

                            CONSTRAINT fk_ur_role
                                FOREIGN KEY (role_id) REFERENCES roles(id)
                                    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


INSERT IGNORE INTO roles(name)
VALUES ('ROLE_USER'), ('ROLE_ADMIN');


-- 3. TOPICS (ROOT)
CREATE TABLE topics (
                        id BIGINT PRIMARY KEY AUTO_INCREMENT,
                        category VARCHAR(30) NOT NULL,
                        title VARCHAR(150) NOT NULL,
                        content LONGTEXT NOT NULL,
                        author_id BIGINT NOT NULL,

                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

                        INDEX idx_topics_category_created (category, created_at),
                        INDEX idx_topics_title (title),

                        CONSTRAINT fk_topics_author
                            FOREIGN KEY (author_id) REFERENCES users(id)
                                ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 4. OPINION NODES (N-ary TREE)
CREATE TABLE opinion_nodes (
                               id BIGINT PRIMARY KEY AUTO_INCREMENT,

                               topic_id BIGINT NOT NULL,
                               parent_id BIGINT NULL,
                               author_id BIGINT NOT NULL,

                               stance ENUM('AGREE', 'NEUTRAL', 'DISAGREE') NULL,

                               content LONGTEXT NOT NULL,

                               is_folded TINYINT(1) NOT NULL DEFAULT 0,

                               created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                               updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                               INDEX idx_opinion_topic (topic_id),
                               INDEX idx_opinion_parent (parent_id),
                               INDEX idx_opinion_author (author_id),
                               INDEX idx_opinion_topic_parent (topic_id, parent_id),
                               INDEX idx_opinion_parent_author_time (parent_id, author_id, created_at),

                               CONSTRAINT fk_opinion_topic
                                   FOREIGN KEY (topic_id) REFERENCES topics(id)
                                       ON DELETE CASCADE,

                               CONSTRAINT fk_opinion_parent
                                   FOREIGN KEY (parent_id) REFERENCES opinion_nodes(id)
                                       ON DELETE CASCADE,

                               CONSTRAINT fk_opinion_author
                                   FOREIGN KEY (author_id) REFERENCES users(id)
                                       ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 5. OPINION STATS (ALGORITHM)
CREATE TABLE opinion_node_stats (
                                    opinion_id BIGINT PRIMARY KEY,

                                    like_count INT NOT NULL DEFAULT 0,
                                    reply_count INT NOT NULL DEFAULT 0,
                                    unique_reply_user_count INT NOT NULL DEFAULT 0,

                                    report_score_spam DECIMAL(6,2) NOT NULL DEFAULT 0,
                                    report_score_harassment DECIMAL(6,2) NOT NULL DEFAULT 0,
                                    report_score_offtopic DECIMAL(6,2) NOT NULL DEFAULT 0,

                                    comment_weight DOUBLE NOT NULL DEFAULT 1,

                                    w_agree DOUBLE NOT NULL DEFAULT 0,
                                    w_neutral DOUBLE NOT NULL DEFAULT 0,
                                    w_disagree DOUBLE NOT NULL DEFAULT 0,

                                    opinion_entropy DOUBLE NOT NULL DEFAULT 0,
                                    engagement_weight DOUBLE NOT NULL DEFAULT 1,
                                    freshness_factor DOUBLE NOT NULL DEFAULT 1,
                                    final_score DOUBLE NOT NULL DEFAULT 0,

                                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                                    CONSTRAINT fk_stats_opinion
                                        FOREIGN KEY (opinion_id) REFERENCES opinion_nodes(id)
                                            ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 6. LIKES
CREATE TABLE opinion_likes (
                               opinion_id BIGINT NOT NULL,
                               user_id BIGINT NOT NULL,

                               created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

                               PRIMARY KEY (opinion_id, user_id),

                               CONSTRAINT fk_like_opinion
                                   FOREIGN KEY (opinion_id) REFERENCES opinion_nodes(id)
                                       ON DELETE CASCADE,

                               CONSTRAINT fk_like_user
                                   FOREIGN KEY (user_id) REFERENCES users(id)
                                       ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 7. UNIQUE REPLY USERS
CREATE TABLE opinion_reply_users (
                                     opinion_id BIGINT NOT NULL,
                                     user_id BIGINT NOT NULL,

                                     PRIMARY KEY (opinion_id, user_id),

                                     CONSTRAINT fk_reply_user_opinion
                                         FOREIGN KEY (opinion_id) REFERENCES opinion_nodes(id)
                                             ON DELETE CASCADE,

                                     CONSTRAINT fk_reply_user_user
                                         FOREIGN KEY (user_id) REFERENCES users(id)
                                             ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 8. REPORTS
CREATE TABLE opinion_reports (
                                 id BIGINT PRIMARY KEY AUTO_INCREMENT,

                                 opinion_id BIGINT NOT NULL,
                                 reporter_id BIGINT NOT NULL,

                                 report_type ENUM('SPAM', 'HARASSMENT', 'OFFTOPIC') NOT NULL,
                                 weight DECIMAL(3,1) NOT NULL,
                                 reason VARCHAR(255),

                                 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

                                 UNIQUE KEY uk_report_once (opinion_id, reporter_id, report_type),

                                 CONSTRAINT fk_report_opinion
                                     FOREIGN KEY (opinion_id) REFERENCES opinion_nodes(id)
                                         ON DELETE CASCADE,

                                 CONSTRAINT fk_report_user
                                     FOREIGN KEY (reporter_id) REFERENCES users(id)
                                         ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;