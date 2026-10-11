resource "google_compute_router" "main" {
  name    = "polaris-ues-vpn-router"
  region  = "us-central1"
  network = data.google_compute_network.main.id
  bgp { asn = 64514 }
}
resource "google_compute_firewall" "aws_database" {
  name          = "polaris-ues-aws-database"
  network       = data.google_compute_network.main.name
  source_ranges = ["10.10.1.0/24"]
  target_tags   = ["polaris-ues-db"]
  allow {
    protocol = "tcp"
    ports    = ["3306"]
  }
}
output "aws_vpn_connection_ids" { value = aws_vpn_connection.gcp[*].id }
output "gcp_gateway_ip_addresses" { value = google_compute_ha_vpn_gateway.main[0].vpn_interfaces[*].ip_address }
