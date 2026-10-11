output "aws_app_ip" {
  value = aws_eip.app.public_ip
}
output "aws_database_endpoint" {
  value = aws_db_instance.main.address
}
output "gcp_app_ip" {
  value = google_compute_address.app.address
}
output "gcp_database_private_ip" {
  value = google_compute_instance.database.network_interface[0].network_ip
}
output "vpn_enabled" {
  value = var.enable_vpn
}
