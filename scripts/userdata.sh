#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq redis-server docker.io postgresql-client python3-pip curl unzip erlang > /dev/null
systemctl enable --now redis-server docker
usermod -aG docker ubuntu
curl -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal > /dev/null
curl -fsSL https://gleam.run/get-gleam.sh | sh > /dev/null
echo 'export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"' >> /home/ubuntu/.bashrc
