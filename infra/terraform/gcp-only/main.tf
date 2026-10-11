terraform {
  required_version = ">= 1.8"
  backend "gcs" { prefix = "polaris-ues/gcp" }
  required_providers {
    google = { source = "hashicorp/google", version = "~> 7.0" }
  }
}
provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}
variable "project_id" { type = string }
variable "region" { default = "us-central1" }
variable "zone" { default = "us-central1-a" }
variable "name" { default = "polaris-ues" }

resource "google_compute_network" "main" {
  name                    = var.name
  auto_create_subnetworks = false
  routing_mode            = "GLOBAL"
}
resource "google_compute_subnetwork" "main" {
  name                     = "${var.name}-private"
  region                   = var.region
  network                  = google_compute_network.main.id
  ip_cidr_range            = "10.20.1.0/24"
  private_ip_google_access = true
}
resource "google_compute_address" "app" {
  name   = "${var.name}-app"
  region = var.region
}
resource "google_compute_firewall" "web" {
  name          = "${var.name}-web"
  network       = google_compute_network.main.name
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["polaris-ues-app"]
  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
}
resource "google_compute_firewall" "iap" {
  name          = "${var.name}-iap"
  network       = google_compute_network.main.name
  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["polaris-ues-app", "polaris-ues-db"]
  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
}
resource "google_compute_firewall" "database" {
  name        = "${var.name}-database"
  network     = google_compute_network.main.name
  source_tags = ["polaris-ues-app"]
  target_tags = ["polaris-ues-db"]
  allow {
    protocol = "tcp"
    ports    = ["3306"]
  }
}
resource "google_compute_router" "main" {
  name    = "${var.name}-router"
  region  = var.region
  network = google_compute_network.main.id
  bgp { asn = 64514 }
}
resource "google_compute_router_nat" "main" {
  name                               = "${var.name}-nat"
  router                             = google_compute_router.main.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"
  subnetwork {
    name                    = google_compute_subnetwork.main.id
    source_ip_ranges_to_nat = ["PRIMARY_IP_RANGE"]
  }
}
resource "google_service_account" "app" {
  account_id   = "${var.name}-app"
  display_name = "Polaris UES application"
}
resource "google_service_account" "database" {
  account_id   = "${var.name}-db"
  display_name = "Polaris UES database"
}
resource "google_service_account" "build" {
  account_id   = "${var.name}-build"
  display_name = "Polaris UES image build"
}
resource "google_project_iam_member" "logs" {
  for_each = { app = google_service_account.app.email, database = google_service_account.database.email, build = google_service_account.build.email }
  project  = var.project_id
  role     = "roles/logging.logWriter"
  member   = "serviceAccount:${each.value}"
}
resource "google_artifact_registry_repository" "app" {
  repository_id = var.name
  location      = var.region
  format        = "DOCKER"
  description   = "Private release images for Polaris UES"
}
resource "google_artifact_registry_repository_iam_member" "build" {
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.app.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.build.email}"
}
resource "google_artifact_registry_repository_iam_member" "runtime" {
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.app.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.app.email}"
}
resource "google_storage_bucket" "builds" {
  name                        = "${var.project_id}-${var.name}-builds"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  lifecycle_rule {
    condition { age = 7 }
    action { type = "Delete" }
  }
}
resource "google_storage_bucket_iam_member" "build" {
  bucket = google_storage_bucket.builds.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.build.email}"
}
resource "google_storage_bucket" "backups" {
  name                        = "${var.project_id}-${var.name}-backups"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  lifecycle_rule {
    condition { age = 7 }
    action { type = "Delete" }
  }
  lifecycle { prevent_destroy = true }
}
resource "google_storage_bucket_iam_member" "backup" {
  bucket = google_storage_bucket.backups.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.database.email}"
}
resource "google_compute_disk" "database" {
  name = "${var.name}-database-data"
  zone = var.zone
  type = "pd-balanced"
  size = 20
  lifecycle { prevent_destroy = true }
}
resource "google_compute_instance" "app" {
  name         = "${var.name}-gcp-app"
  zone         = var.zone
  machine_type = "e2-small"
  tags         = ["polaris-ues-app"]
  labels       = { application = "polaris-ues", environment = "academic" }
  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
      size  = 15
      type  = "pd-balanced"
    }
  }
  network_interface {
    subnetwork = google_compute_subnetwork.main.id
    access_config { nat_ip = google_compute_address.app.address }
  }
  metadata                = { enable-oslogin = "TRUE" }
  metadata_startup_script = file("${path.module}/../bootstrap/docker.sh")
  service_account {
    email  = google_service_account.app.email
    scopes = ["cloud-platform"]
  }
  deletion_protection = true
  shielded_instance_config { enable_secure_boot = true }
}
resource "google_compute_instance" "database" {
  name         = "${var.name}-gcp-mariadb"
  zone         = var.zone
  machine_type = "e2-small"
  tags         = ["polaris-ues-db"]
  labels       = { application = "polaris-ues", environment = "academic" }
  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
      size  = 15
      type  = "pd-balanced"
    }
  }
  attached_disk {
    source      = google_compute_disk.database.id
    device_name = "mariadb-data"
  }
  network_interface {
    subnetwork = google_compute_subnetwork.main.id
    network_ip = "10.20.1.3"
  }
  metadata                = { enable-oslogin = "TRUE" }
  metadata_startup_script = file("${path.module}/../bootstrap/docker.sh")
  service_account {
    email  = google_service_account.database.email
    scopes = ["cloud-platform"]
  }
  deletion_protection = true
  shielded_instance_config { enable_secure_boot = true }
  depends_on = [google_compute_router_nat.main]
}
output "app_ip" { value = google_compute_address.app.address }
output "database_ip" { value = google_compute_instance.database.network_interface[0].network_ip }
output "build_service_account" { value = google_service_account.build.email }
output "source_bucket" { value = google_storage_bucket.builds.name }
output "backup_bucket" { value = google_storage_bucket.backups.name }
