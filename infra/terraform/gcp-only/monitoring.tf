resource "google_monitoring_uptime_check_config" "app" {
  display_name       = "Polaris UES - HTTPS readiness GCP"
  timeout            = "10s"
  period             = "300s"
  log_check_failures = true
  http_check {
    path         = "/api/health/ready"
    port         = 443
    use_ssl      = true
    validate_ssl = true
    accepted_response_status_codes { status_value = 200 }
  }
  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = "gcp.multicloud.polarisenterprisesv.com"
    }
  }
  content_matchers {
    content = "\"status\":\"ready\""
    matcher = "CONTAINS_STRING"
  }
}
