data "aws_availability_zones" "available" {
  state = "available"
}
data "aws_ami" "ubuntu" {

  owners = ["099720109477"]
  filter {
    name   = "image-id"
    values = [var.aws_ami_id]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

}
resource "aws_vpc" "main" {

  cidr_block           = "10.10.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = {
    Name = var.name
  }

}
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
}
resource "aws_subnet" "public" {

  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.10.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags = {
    Name = "${var.name}-public-${count.index}"
  }

}
resource "aws_subnet" "database" {

  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.10.${count.index + 11}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags = {
    Name = "${var.name}-database-${count.index}"
  }

}
resource "aws_route_table" "public" {

  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

}
resource "aws_route_table" "database" {
  vpc_id = aws_vpc.main.id
}
resource "aws_route_table_association" "public" {

  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id

}
resource "aws_route_table_association" "database" {

  count          = 2
  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id

}
resource "aws_security_group" "app" {

  name_prefix = "${var.name}-app-"
  vpc_id      = aws_vpc.main.id
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

}
resource "aws_security_group" "database" {

  name_prefix = "${var.name}-database-"
  vpc_id      = aws_vpc.main.id
  ingress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
  ingress {
    from_port   = 3306
    to_port     = 3306
    protocol    = "tcp"
    cidr_blocks = ["10.20.1.0/24"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["10.20.1.0/24"]
  }

}
resource "aws_iam_role" "app" {

  name_prefix = "${var.name}-app-"
  assume_role_policy = jsonencode({
    Version = "2012-10-17", Statement = [{
      Effect = "Allow", Action = "sts:AssumeRole", Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })

}
resource "aws_iam_role_policy_attachment" "ssm" {

  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"

}
resource "aws_iam_instance_profile" "app" {
  name_prefix = "${var.name}-"
  role        = aws_iam_role.app.name
}
resource "aws_instance" "app" {

  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.aws_app_type
  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.app.id]
  iam_instance_profile        = aws_iam_instance_profile.app.name
  associate_public_ip_address = true
  metadata_options {
    http_tokens = "required"
  }
  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }
  credit_specification { cpu_credits = "standard" }
  disable_api_termination = true
  user_data               = file("${path.module}/../bootstrap/docker.sh")
  tags = {
    Name = "${var.name}-aws-app"
  }

}
resource "aws_eip" "app" {
  domain   = "vpc"
  instance = aws_instance.app.id
  tags = {
    Name = "${var.name}-aws"
  }
}
resource "aws_db_subnet_group" "main" {
  name_prefix = "${var.name}-"
  subnet_ids  = aws_subnet.database[*].id
}
resource "aws_db_parameter_group" "mariadb" {

  name_prefix = "${var.name}-"
  family      = "mariadb11.4"
  parameter {
    name  = "binlog_format"
    value = "ROW"
  }
  parameter {
    name  = "require_secure_transport"
    value = "1"
  }

}
resource "aws_db_instance" "main" {

  identifier                  = "${var.name}-primary"
  engine                      = "mariadb"
  engine_version              = "11.4.13"
  instance_class              = var.aws_db_class
  allocated_storage           = 20
  storage_type                = "gp3"
  storage_encrypted           = true
  db_name                     = "polaris_ues"
  username                    = "polaris_admin"
  manage_master_user_password = true
  # The RDS Free Tier documentation permits Single-AZ only. This is an explicit
  # assessment gap, not a substitute for the required Multi-AZ configuration.
  multi_az                   = false
  publicly_accessible        = false
  db_subnet_group_name       = aws_db_subnet_group.main.name
  vpc_security_group_ids     = [aws_security_group.database.id]
  parameter_group_name       = aws_db_parameter_group.mariadb.name
  backup_retention_period    = 1
  deletion_protection        = true
  skip_final_snapshot        = false
  final_snapshot_identifier  = "${var.name}-final"
  auto_minor_version_upgrade = true
  apply_immediately          = false
  lifecycle {
    prevent_destroy = true
  }
  tags = {
    Name = "${var.name}-primary"
  }

}
