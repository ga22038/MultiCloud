terraform {
  required_version = ">= 1.10.0"
  backend "s3" {
    bucket       = "polaris-ues-117425831688-state"
    key          = "polaris-ues/vpn/terraform.tfstate"
    region       = "us-east-2"
    encrypt      = true
    use_lockfile = true
  }
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 6.0" }
    google = { source = "hashicorp/google", version = "~> 7.0" }
  }
}
provider "aws" {
  region              = "us-east-2"
  allowed_account_ids = ["117425831688"]
  default_tags { tags = { Project = "Polaris UES", Author = "ga22038", ManagedBy = "Terraform" } }
}
provider "google" {
  project = "project-dba46330-c40e-432b-9ad"
  region  = "us-central1"
}
data "terraform_remote_state" "aws" {
  backend = "s3"
  config = {
    bucket = "polaris-ues-117425831688-state"
    key    = "polaris-ues/aws/terraform.tfstate"
    region = "us-east-2"
  }
}
data "google_compute_network" "main" { name = "polaris-ues" }
variable "name" { default = "polaris-ues" }
variable "enable_vpn" { default = true }
variable "gcp_region" { default = "us-central1" }
