output "aws_app_ip" { value = aws_eip.app.public_ip }
output "aws_app_instance_id" { value = aws_instance.app.id }
output "aws_database_endpoint" { value = aws_db_instance.main.address }
output "aws_database_secret_arn" {
  value     = aws_db_instance.main.master_user_secret[0].secret_arn
  sensitive = true
}
output "aws_vpc_id" { value = aws_vpc.main.id }
output "aws_public_route_table_id" { value = aws_route_table.public.id }
output "aws_database_route_table_id" { value = aws_route_table.database.id }
output "aws_image_repository" { value = aws_ecr_repository.app.repository_url }
output "aws_deployment_bucket" { value = aws_s3_bucket.deployment.id }
output "multi_az" { value = aws_db_instance.main.multi_az }
