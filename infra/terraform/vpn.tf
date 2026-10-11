resource "google_compute_ha_vpn_gateway" "main" {

  count   = var.enable_vpn ? 1 : 0
  name    = "${var.name}-ha-vpn"
  region  = var.gcp_region
  network = google_compute_network.main.id

}
resource "aws_vpn_gateway" "main" {

  count           = var.enable_vpn ? 1 : 0
  vpc_id          = aws_vpc.main.id
  amazon_side_asn = 64512

}
resource "aws_customer_gateway" "gcp" {

  count      = var.enable_vpn ? 2 : 0
  bgp_asn    = 64514
  ip_address = google_compute_ha_vpn_gateway.main[0].vpn_interfaces[count.index].ip_address
  type       = "ipsec.1"
  tags = {
    Name = "${var.name}-gcp-${count.index}"
  }

}
resource "aws_vpn_connection" "gcp" {

  count                = var.enable_vpn ? 2 : 0
  customer_gateway_id  = aws_customer_gateway.gcp[count.index].id
  vpn_gateway_id       = aws_vpn_gateway.main[0].id
  type                 = "ipsec.1"
  static_routes_only   = false
  tunnel1_inside_cidr  = "169.254.${21 + count.index * 2}.0/30"
  tunnel2_inside_cidr  = "169.254.${22 + count.index * 2}.0/30"
  tunnel1_ike_versions = ["ikev2"]
  tunnel2_ike_versions = ["ikev2"]
  tags = {
    Name = "${var.name}-gcp-${count.index}"
  }

}
locals {

  vpn_tunnels = var.enable_vpn ? flatten([for connection in aws_vpn_connection.gcp : [
    {
      address = connection.tunnel1_address, secret = connection.tunnel1_preshared_key, gcp_inside = connection.tunnel1_cgw_inside_address, aws_inside = connection.tunnel1_vgw_inside_address
    },
    {
      address = connection.tunnel2_address, secret = connection.tunnel2_preshared_key, gcp_inside = connection.tunnel2_cgw_inside_address, aws_inside = connection.tunnel2_vgw_inside_address
    }
  ]]) : []

}
resource "google_compute_external_vpn_gateway" "aws" {

  count           = var.enable_vpn ? 1 : 0
  name            = "${var.name}-aws-peer"
  redundancy_type = "FOUR_IPS_REDUNDANCY"
  dynamic "interface" {

    for_each = range(4)
    content {
      id         = interface.value
      ip_address = local.vpn_tunnels[interface.value].address
    }

  }

}
resource "google_compute_vpn_tunnel" "aws" {

  count                           = var.enable_vpn ? 4 : 0
  name                            = "${var.name}-aws-${count.index}"
  region                          = var.gcp_region
  vpn_gateway                     = google_compute_ha_vpn_gateway.main[0].id
  vpn_gateway_interface           = floor(count.index / 2)
  peer_external_gateway           = google_compute_external_vpn_gateway.aws[0].id
  peer_external_gateway_interface = count.index
  shared_secret                   = local.vpn_tunnels[count.index].secret
  router                          = google_compute_router.main.id
  ike_version                     = 2

}
resource "google_compute_router_interface" "aws" {

  count      = var.enable_vpn ? 4 : 0
  name       = "aws-${count.index}"
  region     = var.gcp_region
  router     = google_compute_router.main.name
  vpn_tunnel = google_compute_vpn_tunnel.aws[count.index].name
  ip_range   = "${local.vpn_tunnels[count.index].gcp_inside}/30"

}
resource "google_compute_router_peer" "aws" {

  count           = var.enable_vpn ? 4 : 0
  name            = "aws-${count.index}"
  region          = var.gcp_region
  router          = google_compute_router.main.name
  interface       = google_compute_router_interface.aws[count.index].name
  peer_ip_address = local.vpn_tunnels[count.index].aws_inside
  peer_asn        = 64512
  advertise_mode  = "CUSTOM"
  advertised_ip_ranges {
    range = "10.20.0.0/16"
  }

}
resource "aws_vpn_gateway_route_propagation" "public" {

  count          = var.enable_vpn ? 1 : 0
  vpn_gateway_id = aws_vpn_gateway.main[0].id
  route_table_id = aws_route_table.public.id

}
resource "aws_vpn_gateway_route_propagation" "database" {

  count          = var.enable_vpn ? 1 : 0
  vpn_gateway_id = aws_vpn_gateway.main[0].id
  route_table_id = aws_route_table.database.id

}
