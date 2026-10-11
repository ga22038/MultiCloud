variable "aws_region" {
  type    = string
  default = "us-east-2"
}
variable "gcp_project_id" {
  type = string
}
variable "gcp_region" {
  type    = string
  default = "us-central1"
}
variable "gcp_zone" {
  type    = string
  default = "us-central1-a"
}
variable "name" {
  type    = string
  default = "polaris-ues"
}
variable "operator_cidr" {

  description = "IP pública de administración en formato x.x.x.x/32. Nunca 0.0.0.0/0."
  type        = string
  validation {

    condition     = can(cidrhost(var.operator_cidr, 0)) && endswith(var.operator_cidr, "/32")
    error_message = "Usa una única dirección IPv4 /32."

  }

}
variable "aws_app_type" {
  type    = string
  default = "t3.small"
}
variable "aws_db_class" {
  type    = string
  default = "db.t4g.small"
}
variable "gcp_app_type" {
  type    = string
  default = "e2-small"
}
variable "gcp_db_type" {
  type    = string
  default = "e2-small"
}
variable "enable_vpn" {

  type        = bool
  default     = false
  description = "Habilita VPN IPSec redundante con cuatro túneles BGP. Genera cargos recurrentes."

}
