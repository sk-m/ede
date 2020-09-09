-- --------------------------------------------------------
-- Host:                         web-vm.local
-- Server version:               5.7.30-0ubuntu0.18.04.1 - (Ubuntu)
-- Server OS:                    Linux
-- HeidiSQL Version:             10.3.0.5771
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;


-- Dumping database structure for ede_dev
CREATE DATABASE IF NOT EXISTS `ede_dev` /*!40100 DEFAULT CHARACTER SET utf8 */;
USE `ede_dev`;

-- Dumping structure for table ede_dev.config
CREATE TABLE IF NOT EXISTS `config` (
  `id` smallint(5) unsigned NOT NULL AUTO_INCREMENT,
  `key` varchar(64) CHARACTER SET latin1 NOT NULL,
  `value` text CHARACTER SET latin1,
  `value_type` enum('bool','int','string','json','array','allowed_values') CHARACTER SET latin1 NOT NULL DEFAULT 'string',
  `value_pattern` text CHARACTER SET latin1,
  `default_value` text CHARACTER SET latin1,
  `allowed_values` text CHARACTER SET latin1,
  `tags` text CHARACTER SET latin1,
  `description` text CHARACTER SET latin1,
  `source` varchar(64) CHARACTER SET latin1 NOT NULL,
  `access_level` bit(2) NOT NULL DEFAULT b'0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `config_key` (`key`),
  KEY `NOT_EDITABLE` (`key`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8;

-- Dumping data for table ede_dev.config: ~10 rows (approximately)
/*!40000 ALTER TABLE `config` DISABLE KEYS */;
INSERT INTO `config` (`id`, `key`, `value`, `value_type`, `value_pattern`, `default_value`, `allowed_values`, `tags`, `description`, `source`, `access_level`) VALUES
	(1, 'instance.name', 'dev_instance', 'string', '[a-zA-Z0-9_]{1,128}', NULL, NULL, NULL, 'Internal name for the instance', 'ede', b'01'),
	(2, 'instance.display_name', 'Dev Instance', 'string', NULL, NULL, NULL, NULL, 'Display name of this instance', 'ede', b'00'),
	(3, 'instance.current_skin', NULL, 'string', '[a-zA-Z0-9_]{1,128}', 'Omicron', NULL, NULL, 'Currently active skin', 'ede', b'00'),
	(4, 'instance.page_subnametext', 'This is a subname text', 'string', NULL, NULL, NULL, NULL, 'The text under the page name', 'ede', b'00'),
	(5, 'auth.sid_size', NULL, 'int', NULL, '256', NULL, NULL, 'Size of the sid cookie', 'ede', b'01'),
	(6, 'auth.password_hash_iterations', NULL, 'int', NULL, '50000', NULL, NULL, 'Number of iterations to execute on the password', 'ede', b'01'),
	(7, 'auth.password_hash_keylen', NULL, 'int', NULL, '256', NULL, NULL, 'Key length for the password', 'ede', b'01'),
	(8, 'auth.recaptcha_secret', NULL, 'string', NULL, NULL, NULL, NULL, 'Recaptcha secret', 'ede', b'10'),
	(9, 'auth.session_cookie_ttl', NULL, 'int', NULL, '2630000', NULL, NULL, 'Time to live for a session cookie', 'ede', b'01'),
	(10, 'instance.domain', NULL, 'string', '^(?!:\\/\\/)([a-zA-Z0-9-_]+\\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\\.[a-zA-Z]{2,11}?$', 'localhost.local', NULL, NULL, 'This instance\'s domain', 'ede', b'01');
/*!40000 ALTER TABLE `config` ENABLE KEYS */;

-- Dumping structure for table ede_dev.logs
CREATE TABLE IF NOT EXISTS `logs` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `type` varchar(128) NOT NULL,
  `executor` int(10) unsigned NOT NULL,
  `target` varchar(256) NOT NULL,
  `action_text` text NOT NULL,
  `summary_text` varchar(1024) NOT NULL DEFAULT '',
  `created_on` int(10) unsigned NOT NULL,
  `visibility_level` tinyint(3) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `logs_executor` (`executor`),
  CONSTRAINT `logs_executor` FOREIGN KEY (`executor`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- Dumping data for table ede_dev.logs: ~0 rows (approximately)
/*!40000 ALTER TABLE `logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `logs` ENABLE KEYS */;

-- Dumping structure for table ede_dev.namespaces
CREATE TABLE IF NOT EXISTS `namespaces` (
  `id` smallint(6) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(64) NOT NULL,
  `action_restrictions` json NOT NULL,
  `namespace_info` json NOT NULL,
  `show_in_title` bit(1) NOT NULL DEFAULT b'1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `namespace_name` (`name`),
  KEY `NOT_EDITABLE` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;

-- Dumping data for table ede_dev.namespaces: ~2 rows (approximately)
/*!40000 ALTER TABLE `namespaces` DISABLE KEYS */;
INSERT INTO `namespaces` (`id`, `name`, `action_restrictions`, `namespace_info`, `show_in_title`) VALUES
	(1, 'System', '{}', '{}', b'1'),
	(2, 'Main', '{}', '{}', b'0');
/*!40000 ALTER TABLE `namespaces` ENABLE KEYS */;

-- Dumping structure for table ede_dev.pages
CREATE TABLE IF NOT EXISTS `pages` (
  `id` int(10) unsigned NOT NULL DEFAULT '0',
  `namespace` varchar(64) NOT NULL,
  `name` tinytext NOT NULL,
  `page_info` json NOT NULL,
  `action_restrictions` json NOT NULL,
  PRIMARY KEY (`id`),
  KEY `page_namespace` (`namespace`),
  CONSTRAINT `page_namespace` FOREIGN KEY (`namespace`) REFERENCES `namespaces` (`name`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Dumping data for table ede_dev.pages: ~2 rows (approximately)
/*!40000 ALTER TABLE `pages` DISABLE KEYS */;
INSERT INTO `pages` (`id`, `namespace`, `name`, `page_info`, `action_restrictions`) VALUES
	(1, 'Main', 'Test', '{}', '{}'),
	(2, 'System', 'Login', '{"hidetitle": {"value": true, "source": "ede", "value_type": "boolean", "display_name": "Hidden title bar"}}', '{}');
/*!40000 ALTER TABLE `pages` ENABLE KEYS */;

-- Dumping structure for table ede_dev.system_messages
CREATE TABLE IF NOT EXISTS `system_messages` (
  `id` mediumint(8) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(256) NOT NULL,
  `value` mediumtext,
  `default_value` mediumtext,
  `rev_history` json NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `system_message_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8;

-- Dumping data for table ede_dev.system_messages: ~16 rows (approximately)
/*!40000 ALTER TABLE `system_messages` DISABLE KEYS */;
INSERT INTO `system_messages` (`id`, `name`, `value`, `default_value`, `rev_history`) VALUES
	(1, 'page-actionname-edit', NULL, 'Edit', '{}'),
	(2, 'page-actionname-viewhistory', NULL, 'History', '{}'),
	(3, 'page-error-notfound', NULL, 'This page does not exist.', '{}'),
	(4, 'page-badge-pagenotfound', NULL, '<i class="material-icons">close</i> Nonexistent page', '{}'),
	(5, 'page-badge-namespacenotfound', NULL, '<i class="material-icons">close</i> Nonexistent namespace', '{}'),
	(6, 'systempage-error-notfound', NULL, '<span style="color: crimson; font-weight: bold">This system page does not exist.</span>', '{}'),
	(7, 'page-badge-systempage', NULL, '<div><i class="material-icons">build</i> <i>System page</i></div>', '{}'),
	(8, 'right-description-modifyusergroupmembership', NULL, 'Modify user\'s group membership', '{}'),
	(9, 'right-description-modifyusergroups', NULL, 'Complete control over user groups', '{}'),
	(10, 'right-description-renameuser', NULL, 'Rename a user', '{}'),
	(11, 'right-description-blockuser', NULL, 'Block a user', '{}'),
	(12, 'right-description-modifyconfig', NULL, 'Modify EDE Configuration', '{}'),
	(13, 'right-description-editsystemmessages', NULL, 'Modify system messages', '{}'),
	(14, 'dashboard-categoryname-users_and_groups', NULL, 'Users and groups', '{}'),
	(15, 'dashboard-categoryname-ede_config', NULL, 'EDE configuration', '{}'),
	(16, 'dashboard-categoryname-other', NULL, 'Other', '{}');
/*!40000 ALTER TABLE `system_messages` ENABLE KEYS */;

-- Dumping structure for table ede_dev.users
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(256) NOT NULL,
  `email_address` varchar(256) NOT NULL,
  `password` varchar(2048) NOT NULL DEFAULT '',
  `stats` json NOT NULL,
  `blocks` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;

-- Dumping data for table ede_dev.users: ~1 rows (approximately)
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` (`id`, `username`, `email_address`, `password`, `stats`, `blocks`) VALUES
	(1, 'admin', 'invalid@localhost.local', 'pbkdf2;tmB3hIWFDTdlwFNur69YlanFWiaD0TQ+dGNqcLkYA/6+Nmm6QRr0fPKRx9eiIN7IpacL/yIhvne/8sQdVFfS2sxGvDMiPO/ytPka/kNECUOX4i4gNIX8p5oa6vdjEjLuc23+I59d4uKM2rmiim30FpK1XJaOQvtv7rMkAAqorXRNSfwE6ZmKBTqg49n8NlR4e26L/GV9qjKFPr9mqlzTJzPisDl2qseZ8p1aotp5XAtIimmGiQ7s8mFGoe5AJ/2djGlRsRK1xbmM7Eaq4/751JUMikLPIsbrUBw/dRP2S60z4xPhUwFb13ItGyp21mwaXg5cz/UPRvcDzSIqeLJzdQ==;zBTztJqbt1AJ6EV04dPqGq2ylNeCJ7sI468giNK8t1LCYXHf4I3on4G8kQNdicP8ds_HTOQba2tJ9ZyjMyZ0X2XKzX_KxdTt_4gy2ZnFvwTlM1MjC7DbMnUSNp6kzkQiW4qQ0_RpNcC3VKiwnM6tuESKA_y5itagFwtIDR2s35_cU6l2DrEAFLNqDy_AmUcgVn0g5OoDTIfMd75LsJ_Uy71Wv6KEpKWSGxyEDpz1lpz1FWNJqsvIosPTBTdHo7dB8uUyVvGQpc_fEG59GnN_9S7iFHW4nYJA0WWGBMPX5NEiV3vI2PBo6zK4TXz4a1aDnkTxocNeC22DWLhR7I8dkQ==;50000;256', '{"created_on": 1586892000}', NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;

-- Dumping structure for table ede_dev.user_groups
CREATE TABLE IF NOT EXISTS `user_groups` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(128) NOT NULL DEFAULT '',
  `added_rights` text,
  `right_arguments` json NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1;

-- Dumping data for table ede_dev.user_groups: ~1 rows (approximately)
/*!40000 ALTER TABLE `user_groups` DISABLE KEYS */;
INSERT INTO `user_groups` (`id`, `name`, `added_rights`, `right_arguments`) VALUES
	(1, 'sysadmin', 'modifyusergroupmembership;modifyusergroups', '{"modifyusergroups": {}, "modifyusergroupmembership": {"add": "*", "remove": "*"}}');
/*!40000 ALTER TABLE `user_groups` ENABLE KEYS */;

-- Dumping structure for table ede_dev.user_group_membership
CREATE TABLE IF NOT EXISTS `user_group_membership` (
  `user` int(10) unsigned NOT NULL,
  `group` varchar(128) NOT NULL DEFAULT '',
  PRIMARY KEY (`user`,`group`),
  CONSTRAINT `user_group_membership_user` FOREIGN KEY (`user`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- Dumping data for table ede_dev.user_group_membership: ~1 rows (approximately)
/*!40000 ALTER TABLE `user_group_membership` DISABLE KEYS */;
INSERT INTO `user_group_membership` (`user`, `group`) VALUES
	(1, 'sysadmin');
/*!40000 ALTER TABLE `user_group_membership` ENABLE KEYS */;

-- Dumping structure for table ede_dev.user_sessions
CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user` int(11) unsigned NOT NULL,
  `session_token` tinytext NOT NULL,
  `sid_hash` varchar(4096) NOT NULL,
  `sid_salt` varchar(2048) NOT NULL,
  `csrf_token` varchar(1024) NOT NULL,
  `ip_address` varchar(16) NOT NULL,
  `user_agent` varchar(1024) NOT NULL,
  `expires_on` int(11) DEFAULT '0',
  `created_on` int(11) DEFAULT '0',
  `invalid` bit(1) NOT NULL DEFAULT b'0',
  PRIMARY KEY (`id`),
  KEY `user_sessions_user` (`user`),
  CONSTRAINT `user_sessions_user` FOREIGN KEY (`user`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Dumping data for table ede_dev.user_sessions: ~0 rows (approximately)
/*!40000 ALTER TABLE `user_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_sessions` ENABLE KEYS */;

/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IF(@OLD_FOREIGN_KEY_CHECKS IS NULL, 1, @OLD_FOREIGN_KEY_CHECKS) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
