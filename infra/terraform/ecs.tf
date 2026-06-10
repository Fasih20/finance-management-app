locals {
  #database_url = var.neon_database_url
  redis_url    = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379"

  discovery_urls = {
    for key, name in local.discovery_service_names :
    key => "http://${name}.${var.cloud_map_namespace}:${local.service_ports[key]}"
  }

  container_env = {
    frontend = [
      {
        name  = "PORT"
        value = tostring(local.service_ports.frontend)
      },
      {
        name  = "NODE_ENV"
        value = "production"
      },
      {
        name  = "NEXT_PUBLIC_API_URL"
        value = "${aws_apigatewayv2_stage.main.invoke_url}/api"
      },
      {
        name  = "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
        value = var.clerk_publishable_key
      },
      {
        name  = "CLERK_SECRET_KEY"
        value = var.clerk_secret_key
      }
      # NOTE: Don't forget to add your Clerk keys in your GitHub Actions secrets 
      # so the Next.js container has them during the AWS build process!
    ]

    gateway = [
      {
        name  = "PORT"
        value = tostring(local.service_ports.gateway)
      },
      {
        name  = "ACCOUNTS_SERVICE_URL"
        value = local.discovery_urls.accounts
      },
      {
        name  = "TRANSACTIONS_SERVICE_URL"
        value = local.discovery_urls.transactions
      },
      {
        name  = "SUMMARY_SERVICE_URL"
        value = local.discovery_urls.summary
      },
      {
        name  = "SUBSCRIPTIONS_SERVICE_URL"
        value = local.discovery_urls.subscriptions
      }
    ]

    accounts = [
      {
        name  = "PORT"
        value = tostring(local.service_ports.accounts)
      },
      {
        name  = "DATABASE_URL"
        value = var.neon_database_url
      },
      {
        name  = "DB_SCHEMA"
        value = "accounts_service"
      }
    ]

    transactions = [
      {
        name  = "PORT"
        value = tostring(local.service_ports.transactions)
      },
      {
        name  = "DATABASE_URL"
        value = var.neon_database_url
      },
      {
        name  = "DB_SCHEMA"
        value = "transactions_service"
      },
      {
        name  = "REDIS_URL"
        value = local.redis_url
      }
    ]

    summary = [
      {
        name  = "PORT"
        value = tostring(local.service_ports.summary)
      },
      {
        name  = "TRANSACTIONS_SERVICE_URL"
        value = local.discovery_urls.transactions
      },
      {
        name  = "GEMINI_API_KEY"
        value = var.gemini_api_key
      }
    ]

    subscriptions = [
      {
        name  = "PORT"
        value = tostring(local.service_ports.subscriptions)
      },
      {
        name  = "DATABASE_URL"
        value = var.neon_database_url
      },
      {
        name  = "DB_SCHEMA"
        value = "subscriptions_service"
      }
    ]
  }
}

resource "aws_service_discovery_service" "service" {
  for_each = local.discovery_service_names

  name = each.value

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = local.common_tags
}

resource "aws_ecs_task_definition" "service" {
  for_each = toset(local.service_names)

  family                   = "${var.project_name}-${each.key}"
  cpu                      = tostring(local.service_cpu[each.key])
  memory                   = tostring(local.service_memory[each.key])
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = each.key
      image     = "${aws_ecr_repository.service[each.key].repository_url}:${var.image_tag}"
      essential = true
      portMappings = [
        {
          containerPort = local.service_ports[each.key]
          hostPort      = local.service_ports[each.key]
          protocol      = "tcp"
        }
      ]
      environment = local.container_env[each.key]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.service[each.key].name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = each.key
        }
      }
    }
  ])

  tags = local.common_tags

  depends_on = [aws_iam_role_policy_attachment.ecs_execution]
}

resource "aws_ecs_service" "service" {
  for_each = toset(local.service_names)

  name                               = "${var.project_name}-${each.key}"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.service[each.key].arn
  desired_count                      = var.deploy_ecs_services ? 1 : 0
  launch_type                        = "FARGATE"
  enable_execute_command             = true
  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 0

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = each.key == "frontend" ? [aws_security_group.frontend_service.id] : [aws_security_group.services.id]
    assign_public_ip = false
  }

  dynamic "load_balancer" {
    for_each = each.key == "frontend" ? [1] : each.key == "gateway" ? [1] : []

    content {
      target_group_arn = each.key == "frontend" ? aws_lb_target_group.frontend.arn : aws_lb_target_group.gateway.arn
      container_name   = each.key
      container_port   = local.service_ports[each.key]
    }
  }

  dynamic "service_registries" {
    for_each = contains(keys(local.discovery_service_names), each.key) ? [1] : []

    content {
      registry_arn = aws_service_discovery_service.service[each.key].arn
    }
  }

  tags = local.common_tags

  depends_on = [
    aws_lb_listener.frontend,
    aws_lb_listener.gateway,
    aws_apigatewayv2_stage.main
  ]
}


