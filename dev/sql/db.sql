/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;

CREATE DATABASE IF NOT EXISTS `ede_dev_git` /*!40100 DEFAULT CHARACTER SET utf8 */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `ede_dev_git`;

CREATE TABLE IF NOT EXISTS `config` (
  `id` smallint unsigned NOT NULL AUTO_INCREMENT,
  `key` varchar(64) NOT NULL,
  `value` text,
  `value_type` enum('bool','int','string','json','array','allowed_values') NOT NULL DEFAULT 'string',
  `value_pattern` varchar(256) DEFAULT NULL,
  `default_value` text,
  `allowed_values` varchar(2048) DEFAULT NULL,
  `tags` varchar(256) DEFAULT NULL,
  `description` varchar(1024) DEFAULT NULL,
  `source` varchar(64) NOT NULL,
  `access_level` bit(2) NOT NULL DEFAULT b'0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `config_key` (`key`),
  KEY `NOT_EDITABLE` (`key`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8;

/*!40000 ALTER TABLE `config` DISABLE KEYS */;
INSERT INTO `config` (`id`, `key`, `value`, `value_type`, `value_pattern`, `default_value`, `allowed_values`, `tags`, `description`, `source`, `access_level`) VALUES
	(1, 'instance.name', 'dev_instance', 'string', '[a-zA-Z0-9_]{1,128}', NULL, NULL, NULL, 'Internal name for the instance', 'ede', b'01'),
	(2, 'instance.display_name', 'Dev instance', 'string', NULL, NULL, NULL, NULL, 'Display name of this instance', 'ede', b'00'),
	(3, 'instance.current_skin', NULL, 'string', '[a-zA-Z0-9_]{1,128}', 'Omicron', NULL, NULL, 'Currently active skin', 'ede', b'00'),
	(4, 'instance.page_subnametext', 'This is a subname text', 'string', NULL, NULL, NULL, NULL, 'The text under the page name', 'ede', b'00'),
	(5, 'auth.sid_size', NULL, 'int', NULL, '256', NULL, NULL, 'Size of the sid cookie', 'ede', b'01'),
	(6, 'auth.password_hash_iterations', NULL, 'int', NULL, '50000', NULL, NULL, 'Number of iterations to execute on the password', 'ede', b'01'),
	(7, 'auth.password_hash_keylen', NULL, 'int', NULL, '256', NULL, NULL, 'Key length for the password', 'ede', b'01'),
	(8, 'auth.recaptcha_secret', NULL, 'string', NULL, NULL, NULL, NULL, 'Recaptcha secret', 'ede', b'11'),
	(9, 'auth.session_cookie_ttl', NULL, 'int', NULL, '2630000', NULL, NULL, 'Time to live for a session cookie', 'ede', b'01'),
	(10, 'instance.domain', NULL, 'string', '^(?!:\\/\\/)([a-zA-Z0-9-_]+\\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\\.[a-zA-Z]{2,11}?$', 'localhost.local', NULL, NULL, 'This instance\'s domain', 'ede', b'01'),
	(11, 'security.restricted_rights', NULL, 'array', NULL, NULL, NULL, NULL, 'Rights that can not be assigned or removed using the web interface', 'ede', b'01'),
	(12, 'security.protected_groups', NULL, 'array', NULL, NULL, NULL, NULL, 'Groups that can not be deleted using the web interface', 'ede', b'01');
/*!40000 ALTER TABLE `config` ENABLE KEYS */;

CREATE TABLE IF NOT EXISTS `deleted_wiki_pages` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `pageid` int unsigned NOT NULL,
  `namespace` varchar(64) NOT NULL,
  `name` tinytext NOT NULL,
  `page_info` json NOT NULL,
  `action_restrictions` json NOT NULL,
  `deleted_by` int unsigned NOT NULL,
  `deleted_on` int unsigned NOT NULL,
  `delete_summary` varchar(1024) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pageid` (`pageid`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

/*!40000 ALTER TABLE `deleted_wiki_pages` DISABLE KEYS */;
/*!40000 ALTER TABLE `deleted_wiki_pages` ENABLE KEYS */;

CREATE TABLE IF NOT EXISTS `logs` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `type` varchar(128) NOT NULL,
  `executor` int unsigned NOT NULL,
  `target` varchar(256) NOT NULL,
  `action_text` varchar(2048) NOT NULL DEFAULT '',
  `summary_text` varchar(1024) NOT NULL DEFAULT '',
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
  `namespace_info` json NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `namespace_name` (`name`),
  KEY `NOT_EDITABLE` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8;

/*!40000 ALTER TABLE `namespaces` DISABLE KEYS */;
INSERT INTO `namespaces` (`id`, `name`, `content_model`, `action_restrictions`, `namespace_info`) VALUES
	(1, 'System', 'system', '{}', '{}'),
	(2, 'Main', 'wiki', '{}', '{}'),
	(3, 'User', 'system', '{}', '{}'),
	(4, 'Template', 'wiki', '{}', '{}');
/*!40000 ALTER TABLE `namespaces` ENABLE KEYS */;

CREATE TABLE IF NOT EXISTS `revisions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `page` int unsigned DEFAULT NULL,
  `user` int unsigned DEFAULT NULL,
  `content` mediumtext CHARACTER SET utf16 COLLATE utf16_unicode_520_ci NOT NULL,
  `content_hash` varchar(50) NOT NULL,
  `summary` varchar(1024) DEFAULT NULL,
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

CREATE TABLE IF NOT EXISTS `system_messages` (
  `id` mediumint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(256) NOT NULL,
  `value` text,
  `default_value` text,
  `rev_history` json NOT NULL,
  `deletable` bit(1) NOT NULL DEFAULT b'0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `system_message_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8;

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
	(37, 'page-error-deleted', NULL, '<div class="ui-text b">This page was deleted at some point.</div>', '{}', b'0');
/*!40000 ALTER TABLE `system_messages` ENABLE KEYS */;

CREATE TABLE IF NOT EXISTS `users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(256) NOT NULL,
  `email_address` varchar(256) NOT NULL,
  `password` varchar(2048) NOT NULL DEFAULT '',
  `stats` json NOT NULL,
  `blocks` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*!40000 ALTER TABLE `users` DISABLE KEYS */;
/*!40000 ALTER TABLE `users` ENABLE KEYS */;

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

CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user` int unsigned NOT NULL,
  `session_token` tinytext NOT NULL,
  `sid_hash` varchar(4096) NOT NULL,
  `sid_salt` varchar(2048) NOT NULL,
  `csrf_token` varchar(1024) NOT NULL,
  `ip_address` varchar(16) NOT NULL,
  `user_agent` varchar(1024) NOT NULL,
  `expires_on` int DEFAULT '0',
  `created_on` int DEFAULT '0',
  `invalid` bit(1) NOT NULL DEFAULT b'0',
  PRIMARY KEY (`id`),
  KEY `user_sessions_user` (`user`),
  CONSTRAINT `user_sessions_user` FOREIGN KEY (`user`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*!40000 ALTER TABLE `user_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_sessions` ENABLE KEYS */;

CREATE TABLE IF NOT EXISTS `wiki_pages` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `namespace` varchar(64) DEFAULT NULL,
  `name` tinytext NOT NULL,
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

/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IF(@OLD_FOREIGN_KEY_CHECKS IS NULL, 1, @OLD_FOREIGN_KEY_CHECKS) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
