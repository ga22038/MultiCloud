-- Run as database administrator after schema initialization.
-- Replace the fixed database name only if your deployment uses a different schema.
-- The account and its password must be created separately through a secret-aware client.
GRANT SELECT ON polaris_ues.app_users TO 'polaris_app'@'%';
GRANT SELECT, UPDATE ON polaris_ues.application_state TO 'polaris_app'@'%';
GRANT SELECT, INSERT ON polaris_ues.operations TO 'polaris_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON polaris_ues.login_attempts TO 'polaris_app'@'%';
