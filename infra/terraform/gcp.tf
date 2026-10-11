resource "google_compute_network" "main" {
  name                    = var.name
  auto_create_subnetworks = false
  routing_mode            = "GLOBAL"
}
resource "google_compute_subnetwork" "main" {

  name                     = "${var.name}-private"
  network                  = google_compute_network.main.id
  ip_cidr_range            = "10.20.1.0/24"
  region                   = var.gcp_region
  private_ip_google_access = true

}
resource "google_compute_address" "app" {
  name   = "${var.name}-app"
  region = var.gcp_region
}
resource "google_compute_firewall" "web" {

  name          = "${var.name}-web"
  network       = google_compute_network.main.name
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["polaris-app"]
  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

}
resource "google_compute_firewall" "ssh" {

  name          = "${var.name}-admin"
  network       = google_compute_network.main.name
  source_ranges = [var.operator_cidr]
  target_tags   = ["polaris-app", "polaris-database"]
  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

}
resource "google_compute_firewall" "iap" {
  name          = "${var.name}-iap"
  network       = google_compute_network.main.name
  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["polaris-app", "polaris-database"]
  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
}
resource "google_compute_firewall" "database" {

  name          = "${var.name}-database"
  network       = google_compute_network.main.name
  source_ranges = ["10.10.0.0/16", "10.20.1.0/24"]
  target_tags   = ["polaris-database"]
  allow {
    protocol = "tcp"
    ports    = ["3306"]
  }

}
resource "google_service_account" "runtime" {
  account_id   = "${var.name}-runtime"
  display_name = "Polaris UES runtime"
}
resource "google_project_iam_member" "logs" {

  project = var.gcp_project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.runtime.email}"

}
resource "google_compute_router" "main" {

  name    = "${var.name}-router"
  region  = var.gcp_region
  network = google_compute_network.main.id
  bgp {
    asn = 64514
  }

}
resource "google_compute_router_nat" "main" {

  name                               = "${var.name}-nat"
  router                             = google_compute_router.main.name
  region                             = var.gcp_region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"
  subnetwork {
    name                    = google_compute_subnetwork.main.id
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
  }

}
resource "google_compute_instance" "app" {

  name         = "${var.name}-gcp-app"
  machine_type = var.gcp_app_type
  zone         = var.gcp_zone
  tags         = ["polaris-app"]
  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
      size  = 20
      type  = "pd-balanced"
    }
  }
  network_interface {

    subnetwork = google_compute_subnetwork.main.id
    access_config {
      nat_ip = google_compute_address.app.address
    }

  }
  metadata = {
    enable-oslogin = "TRUE"
  }
  metadata_startup_script = file("${path.module}/bootstrap/docker.sh")
  service_account {
    email  = google_service_account.runtime.email
    scopes = ["https://www.googleapis.com/auth/logging.write"]
  }
  deletion_protection = true

}
resource "google_compute_disk" "database" {
  name = "${var.name}-database-data"
  type = "pd-balanced"
  zone = var.gcp_zone
  size = 30
  lifecycle {
    prevent_destroy = true
  }
}
resource "google_compute_instance" "database" {

  name         = "${var.name}-gcp-mariadb"
  machine_type = var.gcp_db_type
  zone         = var.gcp_zone
  tags         = ["polaris-database"]
  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
      size  = 20
      type  = "pd-balanced"
    }
  }
  attached_disk {
    source      = google_compute_disk.database.id
    device_name = "mariadb-data"
  }
  network_interface {
    subnetwork = google_compute_subnetwork.main.id
  }
  metadata = {
    enable-oslogin = "TRUE"
  }
  metadata_startup_script = file("${path.module}/bootstrap/docker.sh")
  service_account {
    email  = google_service_account.runtime.email
    scopes = ["https://www.googleapis.com/auth/logging.write"]
  }
  deletion_protection = true
  depends_on          = [google_compute_router_nat.main]

}
