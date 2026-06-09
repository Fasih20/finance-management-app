data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

locals {
  azs = length(var.availability_zones) > 0 ? var.availability_zones : slice(data.aws_availability_zones.available.names, 0, 2)

  common_tags = merge(
    {
      Project   = var.project_name
      ManagedBy = "terraform"
    },
    var.tags
  )

  service_names = [
    "frontend",
    "gateway",
    "accounts",
    "transactions",
    "summary",
    "subscriptions"
  ]

  service_ports = {
    frontend      = 3000
    gateway       = 8080
    accounts      = 3001
    transactions  = 3002
    summary       = 3003
    subscriptions = 3004
  }

  service_cpu = {
    frontend      = 256
    gateway       = 256
    accounts      = 256
    transactions  = 256
    summary       = 256
    subscriptions = 256
  }

  service_memory = {
    frontend      = 512
    gateway       = 512
    accounts      = 512
    transactions  = 512
    summary       = 512
    subscriptions = 512
  }

  discovery_service_names = {
    gateway       = "gateway-service"
    accounts      = "accounts-service"
    transactions  = "transactions-service"
    summary       = "summary-service"
    subscriptions = "subscriptions-service"
  }
}
