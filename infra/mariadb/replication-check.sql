-- Run on the GCP replica. Contains no credentials and performs no promotion.
SHOW SLAVE STATUS;
SELECT @@server_id, @@global.read_only, @@global.gtid_slave_pos, @@global.gtid_binlog_pos;
SELECT revision, updated_at FROM polaris_ues.application_state WHERE id = 1;
SELECT COUNT(*) AS committed_operations FROM polaris_ues.operations;
