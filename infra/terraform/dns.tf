variable "dns_zone_name" {
  type        = string
  default     = ""
  description = "Subdominio delegado a Route 53, por ejemplo lab.tudominio.com. Vacío omite DNS."
}
resource "aws_route53_zone" "lab" {
  count         = var.dns_zone_name == "" ? 0 : 1
  name          = var.dns_zone_name
  force_destroy = false
  tags          = { Name = var.name }
}
resource "aws_route53_record" "site" {
  for_each = var.dns_zone_name == "" ? {} : { aws = aws_eip.app.public_ip, gcp = google_compute_address.app.address }
  zone_id  = aws_route53_zone.lab[0].zone_id
  name     = "${each.key}.${var.dns_zone_name}"
  type     = "A"
  ttl      = 30
  records  = [each.value]
}
resource "aws_route53_health_check" "site" {
  for_each          = var.dns_zone_name == "" ? toset([]) : toset(["aws", "gcp"])
  fqdn              = aws_route53_record.site[each.key].fqdn
  port              = 443
  type              = "HTTPS_STR_MATCH"
  resource_path     = "/api/health/ready"
  search_string     = "\"status\":\"ready\""
  request_interval  = 30
  failure_threshold = 3
  tags              = { Name = "${var.name}-${each.key}-ready" }
}
resource "aws_route53_record" "failover" {
  for_each       = var.dns_zone_name == "" ? {} : { aws = "PRIMARY", gcp = "SECONDARY" }
  zone_id        = aws_route53_zone.lab[0].zone_id
  name           = "app.${var.dns_zone_name}"
  type           = "A"
  ttl            = 30
  set_identifier = each.key
  failover_routing_policy { type = each.value }
  records         = [each.key == "aws" ? aws_eip.app.public_ip : google_compute_address.app.address]
  health_check_id = aws_route53_health_check.site[each.key].id
}
output "dns_nameservers_to_delegate" { value = try(aws_route53_zone.lab[0].name_servers, []) }
