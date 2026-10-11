resource "aws_cloudwatch_metric_alarm" "app_status" {
  alarm_name          = "polaris-ues-ec2-status"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "missing"
  dimensions          = { InstanceId = aws_instance.app.id }
}
resource "aws_cloudwatch_metric_alarm" "database_storage" {
  alarm_name          = "polaris-ues-rds-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Minimum"
  threshold           = 5368709120
  treat_missing_data  = "missing"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.identifier }
}
