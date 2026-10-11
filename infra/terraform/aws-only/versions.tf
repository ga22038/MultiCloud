terraform {
  required_version = ">= 1.10.0"
  backend "s3" {
    bucket       = "polaris-ues-117425831688-state"
    key          = "polaris-ues/aws/terraform.tfstate"
    region       = "us-east-2"
    encrypt      = true
    use_lockfile = true
  }
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
}
provider "aws" {
  region              = "us-east-2"
  allowed_account_ids = ["117425831688"]
  default_tags { tags = { Project = "Polaris UES", Author = "ga22038", ManagedBy = "Terraform" } }
}
variable "name" { default = "polaris-ues" }
variable "aws_ami_id" {
  default     = "ami-09519cc56eb20524a"
  description = "Ubuntu 24.04 amd64 de Canonical, fijada a la imagen comprobada en Ohio."
}
# This root deliberately preserves the current Free account plan.
variable "aws_app_type" {
  default = "t3.small"
  validation {
    condition     = var.aws_app_type == "t3.small"
    error_message = "La aplicación del laboratorio utiliza t3.small. Revisar el crédito antes de ampliar."
  }
}
variable "aws_db_class" {
  default = "db.t4g.micro"
  validation {
    condition     = var.aws_db_class == "db.t4g.micro"
    error_message = "Conservar la clase micro compatible con el plan gratuito."
  }
}
