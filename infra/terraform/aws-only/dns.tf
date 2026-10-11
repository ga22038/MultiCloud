resource "aws_route53_zone" "multicloud" {
  name    = "multicloud.polarisenterprisesv.com"
  comment = "Polaris UES academic AWS/GCP failover"
  lifecycle { prevent_destroy = true }
}
resource "aws_route53_record" "site" {
  for_each = { aws = aws_eip.app.public_ip, gcp = "34.122.222.237" }
  zone_id  = aws_route53_zone.multicloud.zone_id
  name     = "${each.key}.${aws_route53_zone.multicloud.name}"
  type     = "A"
  ttl      = 60
  records  = [each.value]
}
resource "aws_route53_health_check" "site" {
  for_each          = { aws = aws_eip.app.public_ip, gcp = "34.122.222.237" }
  ip_address        = each.value
  fqdn              = "${each.key}.multicloud.polarisenterprisesv.com"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/api/health/ready"
  failure_threshold = 3
  request_interval  = 30
  enable_sni        = true
  tags              = { Name = "polaris-ues-${each.key}-ready" }
}
resource "aws_route53_record" "app" {
  for_each        = { aws = { type = "PRIMARY", address = aws_eip.app.public_ip }, gcp = { type = "SECONDARY", address = "34.122.222.237" } }
  zone_id         = aws_route53_zone.multicloud.zone_id
  name            = "app.multicloud.polarisenterprisesv.com"
  type            = "A"
  ttl             = 60
  set_identifier  = each.key
  records         = [each.value.address]
  health_check_id = aws_route53_health_check.site[each.key].id
  failover_routing_policy { type = each.value.type }
}
output "multicloud_nameservers" { value = aws_route53_zone.multicloud.name_servers }
output "multicloud_zone_id" { value = aws_route53_zone.multicloud.zone_id }
output "site_health_check_ids" { value = { for site, check in aws_route53_health_check.site : site => check.id } }
