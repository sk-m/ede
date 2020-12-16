/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;

CREATE DATABASE IF NOT EXISTS `ede_dev_git` /*!40100 DEFAULT CHARACTER SET utf8 */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `ede_dev_git`;

CREATE TABLE IF NOT EXISTS `2fa_data` (
  `user` int unsigned NOT NULL AUTO_INCREMENT,
  `secret_key` varchar(64) NOT NULL,
  `backup_codes` json NOT NULL,
  `enabled_on` int unsigned DEFAULT NULL,
  `setup_mode` bit(1) NOT NULL,
  PRIMARY KEY (`user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*!40000 ALTER TABLE `2fa_data` DISABLE KEYS */;
/*!40000 ALTER TABLE `2fa_data` ENABLE KEYS */;

CREATE TABLE IF NOT EXISTS `blocked_addresses` (
  `address` varchar(64) NOT NULL,
  `restrictions` varchar(512) NOT NULL,
  PRIMARY KEY (`address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*!40000 ALTER TABLE `blocked_addresses` DISABLE KEYS */;
/*!40000 ALTER TABLE `blocked_addresses` ENABLE KEYS */;

CREATE TABLE IF NOT EXISTS `config` (
  `id` smallint unsigned NOT NULL AUTO_INCREMENT,
  `key` varchar(64) NOT NULL,
  `value` text,
  `value_type` enum('bool','int','string','json','array','allowed_values') NOT NULL DEFAULT 'string',
  `value_pattern` varchar(256) DEFAULT NULL,
  `default_value` text,
  `allowed_values` varchar(2048) DEFAULT NULL,
  `tags` varchar(256) DEFAULT NULL,
  `triggers` varchar(256) DEFAULT NULL,
  `description` varchar(1024) DEFAULT NULL,
  `source` varchar(64) NOT NULL,
  `access_level` bit(4) NOT NULL DEFAULT b'0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `config_key` (`key`),
  KEY `NOT_EDITABLE` (`key`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8;

/*!40000 ALTER TABLE `config` DISABLE KEYS */;
INSERT INTO `config` (`id`, `key`, `value`, `value_type`, `value_pattern`, `default_value`, `allowed_values`, `tags`, `triggers`, `description`, `source`, `access_level`) VALUES
	(1, 'instance.name', 'dev_instance', 'string', '[a-zA-Z0-9_]{1,128}', NULL, NULL, NULL, NULL, 'Internal name for the instance', 'ede', b'1100'),
	(2, 'instance.display_name', 'Dev instance', 'string', NULL, NULL, NULL, NULL, NULL, 'Display name of this instance', 'ede', b'1000'),
	(3, 'instance.current_skin', NULL, 'string', '[a-zA-Z0-9_]{1,128}', 'Omicron', NULL, NULL, NULL, 'Currently active skin', 'ede', b'0100'),
	(4, 'instance.page_subnametext', 'This is a subname text', 'string', NULL, NULL, NULL, NULL, NULL, 'The text under the page name', 'ede', b'0100'),
	(5, 'auth.sid_size', NULL, 'int', NULL, '256', NULL, NULL, NULL, 'Size of the sid cookie', 'ede', b'1100'),
	(6, 'auth.password_hash_iterations', NULL, 'int', NULL, '50000', NULL, NULL, NULL, 'Number of iterations to execute on the password', 'ede', b'1100'),
	(7, 'auth.password_hash_keylen', NULL, 'int', NULL, '256', NULL, NULL, NULL, 'Key length for the password', 'ede', b'1100'),
	(8, 'auth.recaptcha_secret', NULL, 'string', NULL, NULL, NULL, NULL, NULL, 'Recaptcha secret', 'ede', b'1111'),
	(9, 'auth.session_cookie_ttl', NULL, 'int', NULL, '2630000', NULL, NULL, NULL, 'Time to live for a session cookie', 'ede', b'1100'),
	(10, 'instance.domain', NULL, 'string', '^(?!:\\/\\/)([a-zA-Z0-9-_]+\\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\\.[a-zA-Z]{2,11}?$', 'localhost.local', NULL, NULL, NULL, 'This instance\'s domain', 'ede', b'1100'),
	(11, 'security.restricted_rights', NULL, 'array', NULL, NULL, NULL, NULL, NULL, 'Rights that can not be assigned or removed using the web interface', 'ede', b'1100'),
	(12, 'security.protected_groups', NULL, 'array', NULL, 'sysadmin', NULL, NULL, NULL, 'Groups that can not be deleted using the web interface', 'ede', b'1100'),
	(13, 'mail.enabled', NULL, 'bool', NULL, 'false', NULL, NULL, 'managemailer', 'Enable outbound email. Used for user notification and password restoration', 'ede', b'1000'),
	(14, 'mail.host', NULL, 'string', NULL, NULL, NULL, NULL, NULL, 'Host for outbound email', 'ede', b'1010'),
	(15, 'mail.port', NULL, 'int', NULL, '465', NULL, NULL, NULL, 'Oubound email SMTP server port', 'ede', b'1010'),
	(16, 'mail.user', NULL, 'string', NULL, NULL, NULL, NULL, NULL, 'User for outbound email', 'ede', b'1111'),
	(17, 'mail.password', NULL, 'string', NULL, NULL, NULL, NULL, NULL, 'Password for outbound email user', 'ede', b'1111'),
	(18, 'mail.secure', NULL, 'bool', NULL, 'true', NULL, NULL, NULL, 'Use SSL/TLS for outboud email', 'ede', b'1010'),
	(19, 'mail.ignore_invalid_certs', NULL, 'bool', NULL, 'false', NULL, NULL, NULL, 'Ignore unauthorized certificates', 'ede', b'1010'),
	(20, 'caching.enabled', NULL, 'bool', NULL, 'false', NULL, NULL, 'managecachingserver', 'Enable caching (global switch)', 'ede', b'1010'),
	(21, 'caching.host', NULL, 'string', NULL, '127.0.0.1', NULL, NULL, NULL, 'Hashing database host', 'ede', b'1010'),
	(24, 'caching.port', NULL, 'int', NULL, '6379', NULL, NULL, NULL, 'Hashing database port', 'ede', b'1010'),
	(26, 'caching.cachesystemmessages', NULL, 'bool', NULL, 'true', NULL, NULL, NULL, 'Keep system messages in the cache?', 'ede', b'1010'),
	(27, 'caching.cacheusersids', NULL, 'bool', NULL, 'true', NULL, NULL, NULL, 'Cache cleartext user sids? This will keep user\'s *unhashed* sids in the redis database. If you think that this is unsafe, you can disable this functionality.', 'ede', b'1010'),
	(28, 'caching.cachepagefiles', NULL, 'bool', NULL, 'true', NULL, NULL, NULL, 'Cache system page\'s css, js and other files?', 'ede', b'1010'),
	(29, 'security.protected_actions', NULL, 'array', NULL, NULL, NULL, NULL, NULL, 'Actions (represented as API route names) that require a two-factor verification', 'ede', b'1100');
/*!40000 ALTER TABLE `config` ENABLE KEYS */;

CREATE TABLE IF NOT EXISTS `deleted_wiki_pages` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `pageid` int unsigned NOT NULL,
  `namespace` varchar(64) NOT NULL,
  `name` varchar(2048) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `page_info` json NOT NULL,
  `action_restrictions` json NOT NULL,
  `deleted_by` int unsigned NOT NULL,
  `deleted_on` int unsigned NOT NULL,
  `delete_summary` varbinary(4096) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pageid` (`pageid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*!40000 ALTER TABLE `deleted_wiki_pages` DISABLE KEYS */;
/*!40000 ALTER TABLE `deleted_wiki_pages` ENABLE KEYS */;

CREATE TABLE IF NOT EXISTS `elevated_user_sessions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user` int unsigned NOT NULL,
  `esid` tinytext NOT NULL,
  `valid_until` int unsigned NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*!40000 ALTER TABLE `elevated_user_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `elevated_user_sessions` ENABLE KEYS */;

CREATE TABLE IF NOT EXISTS `email_tokens` (
  `token` varchar(1024) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `user` int unsigned NOT NULL,
  `type` varchar(32) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '',
  `sent_to` varchar(512) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `valid_until` int unsigned NOT NULL,
  PRIMARY KEY (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*!40000 ALTER TABLE `email_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `email_tokens` ENABLE KEYS */;

CREATE TABLE IF NOT EXISTS `incident_logs` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `severity` tinyint unsigned NOT NULL,
  `error_message` text NOT NULL,
  `error_stacktrace` text,
  `error_info` json DEFAULT NULL,
  `timestamp` int unsigned NOT NULL,
  `events` int unsigned NOT NULL DEFAULT '1',
  `was_handled` bit(1) NOT NULL,
  `is_read` bit(1) NOT NULL DEFAULT b'0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/*!40000 ALTER TABLE `incident_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `incident_logs` ENABLE KEYS */;

CREATE TABLE IF NOT EXISTS `logs` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `type` varchar(128) NOT NULL,
  `executor` int unsigned NOT NULL,
  `target` varchar(256) NOT NULL,
  `action_text` varbinary(4096) NOT NULL,
  `summary_text` varbinary(4096) DEFAULT NULL,
  `created_on` int unsigned NOT NULL,
  `visibility_level` tinyint unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `logs_executor` (`executor`),
  CONSTRAINT `logs_executor` FOREIGN KEY (`executor`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*!40000 ALTER TABLE `logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `logs` ENABLE KEYS */;

CREATE TABLE IF NOT EXISTS `namespaces` (
  `id` smallint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(64) NOT NULL,
  `content_model` varchar(32) NOT NULL DEFAULT 'wiki',
  `action_restrictions` json NOT NULL,
  `info` json NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `namespace_name` (`name`),
  KEY `NOT_EDITABLE` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8;

/*!40000 ALTER TABLE `namespaces` DISABLE KEYS */;
INSERT INTO `namespaces` (`id`, `name`, `content_model`, `action_restrictions`, `info`) VALUES
	(1, 'System', 'system', '{}', '{}'),
	(2, 'Main', 'wiki', '{}', '{"hiddennamespacename": true}'),
	(3, 'User', 'system', '{}', '{}'),
	(4, 'Template', 'wiki', '{}', '{}');
/*!40000 ALTER TABLE `namespaces` ENABLE KEYS */;

DELIMITER //
CREATE PROCEDURE `new_incident_log`(
	IN `p_severity` TINYINT,
	IN `p_error_message` TEXT,
	IN `p_error_stacktrace` TEXT,
	IN `p_error_info` JSON,
	IN `p_was_handled` BIT
)
    NO SQL
    COMMENT 'Creates a new incident_logs entry or increments an events field if already reported before'
BEGIN
	DECLARE l_id INT;

	# Check if there is already a record with the same stack trace
	SELECT id INTO l_id FROM `incident_logs` WHERE `error_stacktrace` = p_error_stacktrace LIMIT 1;
	
	IF l_id IS NULL THEN
		# No such records, this is a new error. Create a new enrty
		INSERT INTO `incident_logs` (`severity`, `error_message`, `error_stacktrace`, `error_info`, `timestamp`, `was_handled`)
		VALUES (p_severity, p_error_message, p_error_stacktrace, p_error_info, UNIX_TIMESTAMP(), p_was_handled);
	ELSE
		# There is already a record with the same stack trace
		UPDATE `incident_logs` SET `events` = `events` + 1, `error_info` = p_error_info WHERE id = l_id;
	END IF;
END//
DELIMITER ;

CREATE TABLE IF NOT EXISTS `revisions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `page` int unsigned DEFAULT NULL,
  `user` int unsigned DEFAULT NULL,
  `content` mediumblob NOT NULL,
  `content_hash` varchar(50) NOT NULL,
  `summary` varbinary(4096) DEFAULT NULL,
  `visibility` bit(5) NOT NULL DEFAULT b'0',
  `tags` varchar(512) NOT NULL DEFAULT '',
  `timestamp` int unsigned NOT NULL,
  `bytes_size` int NOT NULL,
  `bytes_change` int NOT NULL,
  `is_deleted` bit(1) NOT NULL DEFAULT b'0',
  PRIMARY KEY (`id`),
  KEY `revision_page` (`page`),
  KEY `revision_user` (`user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*!40000 ALTER TABLE `revisions` DISABLE KEYS */;
/*!40000 ALTER TABLE `revisions` ENABLE KEYS */;

DELIMITER //
CREATE PROCEDURE `systemmessage_remove`(
	IN `p_name` VARCHAR(256)
)
    NO SQL
    COMMENT 'Delete a system message'
BEGIN
	DECLARE l_id INT;
	DECLARE l_deletable BIT(1);

	# Get the system message
	SELECT id, `deletable` INTO l_id, l_deletable FROM `system_messages` WHERE `name` = p_name LIMIT 1;
	
	# Check if requested system message is deletable
	IF l_deletable = b'1' THEN
		# Delete system message
		DELETE FROM `system_messages` WHERE id = l_id;
		SELECT 1 AS status_success;
	ELSE
		# System message is non-deletable
		SELECT 1 AS status_non_deletable;
	END IF;
END//
DELIMITER ;

CREATE TABLE IF NOT EXISTS `system_messages` (
  `id` mediumint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(256) NOT NULL,
  `value` text CHARACTER SET utf8 COLLATE utf8_general_ci,
  `default_value` text,
  `rev_history` json NOT NULL,
  `deletable` bit(1) NOT NULL DEFAULT b'0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `system_message_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8;

/*!40000 ALTER TABLE `system_messages` DISABLE KEYS */;
INSERT INTO `system_messages` (`id`, `name`, `value`, `default_value`, `rev_history`, `deletable`) VALUES
	(1, 'page-actionname-edit', NULL, 'Edit', '{}', b'0'),
	(2, 'page-actionname-viewhistory', NULL, 'History', '{}', b'0'),
	(3, 'page-error-notfound', NULL, 'This page does not exist.', '{}', b'0'),
	(4, 'page-badge-pagenotfound', NULL, '<i class="material-icons">close</i> Nonexistent page', '{}', b'0'),
	(5, 'page-badge-namespacenotfound', NULL, '<i class="material-icons">close</i> Nonexistent namespace', '{}', b'0'),
	(6, 'systempage-error-notfound', NULL, '<span style="color: crimson; font-weight: bold">This system page does not exist.</span>', '{}', b'0'),
	(7, 'page-badge-systempage', NULL, '<div><i class="material-icons">build</i> <i>System page</i></div>', '{}', b'0'),
	(8, 'right-description-modifyusergroupmembership', NULL, 'Modify user\'s group membership', '{}', b'0'),
	(9, 'right-description-modifyusergroups', NULL, 'Complete control over user groups', '{}', b'0'),
	(10, 'right-description-renameuser', NULL, 'Rename a user', '{}', b'0'),
	(11, 'right-description-blockuser', NULL, 'Block a user', '{}', b'0'),
	(12, 'right-description-modifyconfig', NULL, 'Modify EDE Configuration', '{}', b'0'),
	(13, 'right-description-editsystemmessages', NULL, 'Modify system messages', '{}', b'0'),
	(14, 'dashboard-categoryname-users_and_groups', NULL, 'Users and groups', '{}', b'0'),
	(15, 'dashboard-categoryname-ede_config', NULL, 'EDE configuration', '{}', b'0'),
	(16, 'dashboard-categoryname-other', NULL, 'Other', '{}', b'0'),
	(17, 'usergroupmanagement-toptext', NULL, 'You can use this page to edit user groups. Be careful, though — this is a dangerous tool, so use it with caution and review your changes before saving.<br><br>\r\nYou can create new groups on the root <a href="/System:UserGroupManagement">User Group Management</a> page.', '{}', b'0'),
	(18, 'usergroupmembership-toptext', NULL, 'Groups tip:\r\n<ul>\r\n<li><i>Sysadmin</i>. Has pretty much unrestricted access to everything. Assign to system administrators only.</li>\r\n<li><i>Verified</i>. You can assign this right to verifiy people you trust and grant them a bit more rights.</li>\r\n</ul>', '{}', b'0'),
	(19, 'usergroupmanagement-savetext', NULL, 'Don\'t forget the summary', '{}', b'0'),
	(20, 'usergroupmembership-savetext', NULL, 'Don\'t forget the summary', '{}', b'0'),
	(21, 'login-message-blocked', NULL, 'This account is currenly blocked, logging in is disallowed.<br><br>', '{}', b'0'),
	(22, 'login-message-invalidcredentials', NULL, 'This combination of username and password is incorrect.', '{}', b'0'),
	(23, 'edeconfig-category-instance-name', NULL, 'Instance', '{}', b'0'),
	(24, 'edeconfig-category-instance-description', NULL, 'General instance configuration', '{}', b'0'),
	(25, 'edeconfig-category-auth-name', NULL, 'Authentication', '{}', b'0'),
	(26, 'edeconfig-category-auth-description', NULL, 'Authentication related configuration items', '{}', b'0'),
	(27, 'edeconfig-category-auth-iconclass', NULL, 'fas fa-user-cog', '{}', b'0'),
	(28, 'edeconfig-category-instance-iconclass', NULL, 'fas fa-server', '{}', b'0'),
	(29, 'right-description-wiki_edit', NULL, 'Edit wiki pages', '{}', b'0'),
	(30, 'right-description-wiki_createpage', NULL, 'Create new wiki pages', '{}', b'0'),
	(31, 'edeconfig-category-security-name', NULL, 'Security', '{}', b'0'),
	(32, 'edeconfig-category-security-description', NULL, 'Security related configuration items', '{}', b'0'),
	(33, 'edeconfig-category-security-iconclass', NULL, 'fas fa-shield-alt', '{}', b'0'),
	(34, 'wikipagedelete-toptext', NULL, 'Deleting a page will make it completely inaccessible and will hide all related revisions (logs will still be accessible). Only users with <code>wiki_restorepage</code> right will be able see it\'s contents and revisions.<br><br>\r\n\r\nHowever, if you want to <u>completely</u> remove this page and all related revisions from the database, without any going back, check the checkbox below.  But remember, <b class="ui-text">this action is <i>irreversible</i></b>. In the case of full removal, access level of related logs will  be set to <code class="ui-code">1</code> (not visible to users without the right).', '{}', b'0'),
	(35, 'right-description-wiki_deletepage', NULL, 'Delete wiki pages', '{}', b'0'),
	(36, 'wikipagerestore-toptext', NULL, 'You are about to restore the page', '{}', b'0'),
	(37, 'page-error-deleted', NULL, '<div class="ui-text b">This page was deleted at some point.</div>', '{}', b'0'),
	(38, 'login-join-message-ipblocked', NULL, 'Your ip address is currently blocked from creating new accounts.', '{}', b'0'),
	(39, 'edeconfig-category-mail-name', NULL, 'Mail', '{}', b'0'),
	(40, 'edeconfig-category-mail-description', NULL, 'Mail related configuration items', '{}', b'0'),
	(41, 'edeconfig-category-mail-iconclass', NULL, 'fas fa-envelope', '{}', b'0'),
	(42, 'edeconfig-category-caching-name', NULL, 'Caching', '{}', b'0'),
	(43, 'edeconfig-category-caching-description', NULL, 'Caching related configuration items. EDE uses Redis for caching, if enabled. You can also use some Redis forks like KeyDB with EDE.', '{}', b'0'),
	(44, 'edeconfig-category-caching-iconclass', NULL, 'fas fa-fire', '{}', b'0');
/*!40000 ALTER TABLE `system_messages` ENABLE KEYS */;

CREATE TABLE IF NOT EXISTS `users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(256) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `email_address` varchar(256) NOT NULL,
  `email_verified` bit(1) NOT NULL DEFAULT b'0',
  `password` varchar(2048) NOT NULL DEFAULT '',
  `stats` json NOT NULL,
  `blocks` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*!40000 ALTER TABLE `users` DISABLE KEYS */;
/*!40000 ALTER TABLE `users` ENABLE KEYS */;

DELIMITER //
CREATE PROCEDURE `user_get_with_session`(
	IN `p_user_id` INT,
	IN `p_session_token` TINYTEXT
)
    NO SQL
    COMMENT 'Get a user and their session'
BEGIN
	SELECT
		`user_sessions`.`sid_hash` AS `session_sid_hash`,
		`user_sessions`.`sid_salt` AS `session_sid_salt`,
		`user_sessions`.`csrf_token` AS `session_csrf_token`,
		`user_sessions`.`expires_on` AS `session_expires_on`,
		`user_sessions`.`created_on` AS `session_created_on`,
		
		`users`.`username` AS `user_username`,
		`users`.`email_address` AS `user_email_address`,
		`users`.`email_verified` AS `user_email_verified`,
		`users`.`password` AS `user_password`,
		`users`.`stats` AS `user_stats`,
		`users`.`blocks` AS `user_blocks`
	FROM `user_sessions`
	INNER JOIN `users` ON `users`.id = p_user_id
	WHERE `user_sessions`.`user` = p_user_id AND `user_sessions`.`session_token` = p_session_token;
END//
DELIMITER ;

CREATE TABLE IF NOT EXISTS `user_groups` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(128) NOT NULL DEFAULT '',
  `added_rights` varchar(8192) DEFAULT '',
  `right_arguments` json NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;

/*!40000 ALTER TABLE `user_groups` DISABLE KEYS */;
INSERT INTO `user_groups` (`id`, `name`, `added_rights`, `right_arguments`) VALUES
	(1, 'sysadmin', 'modifyusergroupmembership;modifyusergroups', '{"modifyusergroupmembership": {"add": ["*"], "remove": ["*"]}}'),
	(2, 'verified', '', '{}');
/*!40000 ALTER TABLE `user_groups` ENABLE KEYS */;

CREATE TABLE IF NOT EXISTS `user_group_membership` (
  `user` int unsigned NOT NULL,
  `group` varchar(128) NOT NULL DEFAULT '',
  PRIMARY KEY (`user`,`group`),
  CONSTRAINT `user_group_membership_user` FOREIGN KEY (`user`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*!40000 ALTER TABLE `user_group_membership` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_group_membership` ENABLE KEYS */;

CREATE TABLE IF NOT EXISTS `user_notifications` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user` int unsigned NOT NULL,
  `type` varchar(64) NOT NULL,
  `text` varchar(4096) NOT NULL,
  `additional_text` varchar(4096) DEFAULT NULL,
  `additional_info` json NOT NULL,
  `timestamp` int unsigned NOT NULL,
  `is_read` bit(1) NOT NULL DEFAULT b'0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/*!40000 ALTER TABLE `user_notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_notifications` ENABLE KEYS */;

CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user` int unsigned NOT NULL,
  `session_token` tinytext NOT NULL,
  `sid_hash` varchar(4096) NOT NULL,
  `sid_salt` varchar(2048) NOT NULL,
  `csrf_token` varchar(1024) NOT NULL,
  `expires_on` int DEFAULT '0',
  `created_on` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `user_sessions_user` (`user`),
  CONSTRAINT `user_sessions_user` FOREIGN KEY (`user`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*!40000 ALTER TABLE `user_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_sessions` ENABLE KEYS */;

DELIMITER //
CREATE EVENT `user_sessions_cleanup` ON SCHEDULE EVERY 1 DAY STARTS '2020-10-23 00:00:01' ON COMPLETION NOT PRESERVE ENABLE COMMENT 'Deletes invalidated and expired user sessions' DO BEGIN
	DELETE FROM `user_sessions` WHERE `expires_on` < UNIX_TIMESTAMP();
	DELETE FROM `elevated_user_sessions` WHERE `valid_until` < UNIX_TIMESTAMP();
END//
DELIMITER ;

CREATE TABLE IF NOT EXISTS `user_tracking` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user` int unsigned NOT NULL,
  `ip_address` varchar(16) DEFAULT NULL,
  `user_agent` varchar(1024) DEFAULT NULL,
  `timestamp` int unsigned NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*!40000 ALTER TABLE `user_tracking` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_tracking` ENABLE KEYS */;

DELIMITER //
CREATE PROCEDURE `wiki_create_revision`(
	IN `p_page_id` INT,
	IN `p_user_id` INT,
	IN `p_content` MEDIUMBLOB,
	IN `p_content_hash` VARCHAR(50),
	IN `p_summary` VARBINARY(4096),
	IN `p_bytes_size` INT
)
    NO SQL
    COMMENT 'Creates a new revision for a wiki page'
BEGIN
	DECLARE l_last_rev_size INT;
	DECLARE l_bytes_change INT;

	# Get the size of the last revision
	SELECT `bytes_size` INTO l_last_rev_size FROM `revisions` WHERE `page` = p_page_id ORDER BY id DESC LIMIT 1;


	# Calculate size change (set to 0 if new page)
	SET l_bytes_change = IFNULL((SELECT p_bytes_size - l_last_rev_size), 0);

	# Create a new revision
	INSERT INTO `revisions` (`page`, `user`, `content`, `content_hash`, `summary`, `timestamp`, `bytes_size`, `bytes_change`)
	VALUES (p_page_id, p_user_id, p_content, p_content_hash, p_summary, UNIX_TIMESTAMP(), p_bytes_size, l_bytes_change);

	# Update the page
	UPDATE `wiki_pages` SET `revision` = LAST_INSERT_ID() WHERE id = p_page_id;
END//
DELIMITER ;

DELIMITER //
CREATE PROCEDURE `wiki_delete_page`(
	IN `p_namespace` TINYTEXT,
	IN `p_name` VARCHAR(2048),
	IN `p_deleted_by` INT,
	IN `p_delete_summary` VARBINARY(4096)
)
    NO SQL
    COMMENT 'Delete (move to archive) a wiki page'
this_proc: BEGIN
	DECLARE l_page_id INT;
	DECLARE l_page_info JSON;
	DECLARE l_page_action_restrictions JSON;
	
	# Get the page
	SELECT id, `page_info`, `action_restrictions` INTO l_page_id, l_page_info, l_page_action_restrictions
	FROM `wiki_pages` WHERE `namespace` = p_namespace AND `name` = p_name;
	
	# Check if page was found
	IF l_page_id IS NULL THEN
		SELECT 1 AS `status_not_found`;
		LEAVE this_proc;
	END IF;
	
	# Create an archive entry
	INSERT INTO `deleted_wiki_pages` (`pageid`, `namespace`, `name`, `page_info`, `action_restrictions`, `deleted_by`, `deleted_on`, `delete_summary`)
	VALUES (l_page_id, p_namespace, p_name, l_page_info, l_page_action_restrictions, p_deleted_by, UNIX_TIMESTAMP(), p_delete_summary);
	
	# Delete the page from the wiki_pages
	DELETE FROM `wiki_pages` WHERE id = l_page_id;
	
	# Hide (delete) all related revisions
	UPDATE `revisions` SET `is_deleted` = b'1' WHERE `page` = l_page_id;
	
	# Return page id
	SELECT l_page_id AS page_id;
END//
DELIMITER ;

DELIMITER //
CREATE PROCEDURE `wiki_get_page`(
	IN `p_namespace` VARCHAR(64),
	IN `p_name` VARCHAR(2048)
)
    NO SQL
    COMMENT 'Get a wiki page and it''s content'
BEGIN
	DECLARE l_pageid INT;
	DECLARE l_revid INT;

	# Find a last revision id for a page
	SELECT id, `revision` INTO l_pageid, l_revid FROM `wiki_pages` WHERE `namespace` = p_namespace AND `name` = p_name LIMIT 1;
	
	# "Return" the page id, revision id and some info about a revision
	SELECT id AS revid, l_pageid AS pageid, `content`, `visibility` FROM `revisions` WHERE id = l_revid;
END//
DELIMITER ;

DELIMITER //
CREATE PROCEDURE `wiki_get_page_by_revid`(
	IN `p_revid` INT
)
    NO SQL
    COMMENT 'Get a wiki page by the revid'
BEGIN
	DECLARE l_pageid INT;
	DECLARE l_content TEXT;
	DECLARE l_visibility BIT(5);
	DECLARE l_namespace VARCHAR(64);
	DECLARE l_name VARCHAR(2048);
	DECLARE l_is_deleted BIT(1);

	# Get a revision by provided revid and get it's pageid
	SELECT `page`, `content`, `visibility`, `is_deleted` INTO l_pageid, l_content, l_visibility, l_is_deleted FROM `revisions` WHERE id = p_revid LIMIT 1;

	IF l_is_deleted = b'1' THEN
		# Get deleted page
		SELECT l_is_deleted AS is_deleted, l_pageid AS pageid, l_content AS content, l_visibility AS visibility, `name`, `namespace` FROM `deleted_wiki_pages` WHERE `pageid` = l_pageid LIMIT 1;
	ELSE
		#Get normal page
		SELECT l_is_deleted AS is_deleted, l_pageid AS pageid, l_content AS content, `revision` AS current_revid, l_visibility AS visibility, `name`, `namespace` FROM `wiki_pages` WHERE id = l_pageid LIMIT 1;
	END IF;
END//
DELIMITER ;

DELIMITER //
CREATE PROCEDURE `wiki_move_page`(
	IN `p_old_namespace` TINYTEXT,
	IN `p_old_name` VARCHAR(2048),
	IN `p_new_namespace` TINYTEXT,
	IN `p_new_name` VARCHAR(2048)
)
    NO SQL
    COMMENT 'Move (rename) a wiki page'
this_proc: BEGIN
	DECLARE l_old_page_id INT;
	DECLARE l_new_page_id INT;
	
	# Get the current page
	SELECT id INTO l_old_page_id FROM `wiki_pages` WHERE `namespace` = p_old_namespace AND `name` = p_old_name;
	
	# Check if such page exists
	IF l_old_page_id IS NULL THEN
		SELECT 1 AS status_not_found;
		LEAVE this_proc;
	END IF;
	
	# Get the target page
	SELECT id INTO l_new_page_id FROM `wiki_pages` WHERE `namespace` = p_new_namespace AND `name` = p_new_name;
	
	# Check if the page with a new title already exists
	IF l_new_page_id IS NULL THEN
		# New title is not already taken, move the page
		UPDATE `wiki_pages` SET `namespace` = p_new_namespace, `name` = p_new_name WHERE id = l_old_page_id;
		SELECT l_old_page_id AS page_id;
	ELSE
		SELECT 1 AS status_already_exists;
	END IF;
END//
DELIMITER ;

CREATE TABLE IF NOT EXISTS `wiki_pages` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `namespace` varchar(64) DEFAULT NULL,
  `name` varchar(2048) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `revision` bigint unsigned DEFAULT NULL,
  `page_info` json NOT NULL,
  `action_restrictions` json NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `revision` (`revision`),
  KEY `namespace` (`namespace`),
  CONSTRAINT `namespace` FOREIGN KEY (`namespace`) REFERENCES `namespaces` (`name`) ON DELETE SET NULL,
  CONSTRAINT `revision` FOREIGN KEY (`revision`) REFERENCES `revisions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*!40000 ALTER TABLE `wiki_pages` DISABLE KEYS */;
/*!40000 ALTER TABLE `wiki_pages` ENABLE KEYS */;

DELIMITER //
CREATE FUNCTION `wiki_restore_page`(
	`p_old_pageid` INT,
	`p_namespace` VARCHAR(64),
	`p_name` VARCHAR(2048),
	`p_revid` INT,
	`p_page_info` JSON,
	`p_action_restrictions` JSON
) RETURNS int
    NO SQL
    COMMENT 'Restore a wiki page'
BEGIN
	DECLARE l_new_pageid INT;

	# Create a new page (restore)
	INSERT INTO `wiki_pages` (`namespace`, `name`, `revision`, `page_info`, `action_restrictions`)
   VALUES (p_namespace, p_name, p_revid, p_page_info, p_action_restrictions);
	
	# Get the new page id
	SET l_new_pageid = LAST_INSERT_ID();
	
	# Undelete revisions
	UPDATE `revisions` SET `page` = l_new_pageid, `is_deleted` = b'0' WHERE `page` = p_old_pageid;
   
   # Delete the page from the archive
   DELETE FROM `deleted_wiki_pages` WHERE `pageid` = p_old_pageid;
	
	# Return the new pageid
	RETURN l_new_pageid;
END//
DELIMITER ;

/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IF(@OLD_FOREIGN_KEY_CHECKS IS NULL, 1, @OLD_FOREIGN_KEY_CHECKS) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
