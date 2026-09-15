# Open this file in the Extension Development Host to test IntelliSense.
#
# Try:
#   1. Type "res"           -> autocomplete offers `resource` with a snippet
#   2. Inside resource "..."-> resource type suggestions (aws_instance, ...)
#   3. Type lookup(         -> signature help shows map, key, default
#   4. Hover over `variable`, `lookup`, or `instance_type` -> tooltip

variable "instance_type" {
  type        = string
  description = "EC2 size"
  default     = "t3.micro"
}

resource "aws_instance" "web" {
  ami           = "ami-12345678"
  instance_type = var.instance_type
  tags = {
    Name = format("web-%03d", 1)
  }
}

output "instance_id" {
  value = aws_instance.web.id
}
