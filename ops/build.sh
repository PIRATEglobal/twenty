#!/bin/sh
set -eu

# Coolify preserves Buildx definitions between helper containers.
if docker buildx inspect twenty-production >/dev/null 2>&1; then
  docker buildx rm --keep-state twenty-production >/dev/null
fi

available_kib=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
if [ "$available_kib" -lt 5242880 ]; then
  echo 'Twenty build needs at least 5 GiB available host memory; retry when capacity is available.' >&2
  exit 1
fi

# Keep the cache volume while recreating the bounded, isolated builder.
docker buildx create \
  --name twenty-production \
  --driver docker-container \
  --driver-opt memory=4608m,memory-swap=6g,cpu-quota=150000,cpu-period=100000,default-load=true,cgroup-parent=pirate-build.slice \
  --buildkitd-config ops/buildkitd.toml

# Buildx applies cgroup-parent only with cgroupfs; this host uses systemd.
docker create --name buildx_buildkit_twenty-production0 \
  --privileged --init --restart=no \
  --cgroup-parent=pirate-build.slice \
  --memory=4608m --memory-swap=6g --cpus=1.5 --pids-limit=512 \
  --mount type=volume,source=buildx_buildkit_twenty-production0_state,target=/var/lib/buildkit \
  moby/buildkit:buildx-stable-1 --config=/etc/buildkitd.toml >/dev/null
docker cp ops/buildkitd.toml buildx_buildkit_twenty-production0:/etc/buildkitd.toml
trap 'docker buildx stop twenty-production >/dev/null' EXIT
docker buildx inspect --bootstrap twenty-production >/dev/null
builder_parent=$(docker inspect --format '{{.HostConfig.CgroupParent}}' buildx_buildkit_twenty-production0)
if [ "$builder_parent" != pirate-build.slice ]; then
  echo 'Twenty builder must run outside the shared production container resource group.' >&2
  exit 1
fi
docker update --memory=4608m --memory-swap=6g --pids-limit=512 \
  buildx_buildkit_twenty-production0 >/dev/null

# Coolify keeps runtime secrets out of the build-time environment file.
export TWENTY_PUBLIC_URL=https://crm.i.pirate.builders
export TWENTY_APP_SECRET=build-validation-only
export PG_DATABASE_URL=postgres://build:build@localhost:5432/default

docker compose \
  --env-file /artifacts/build-time.env \
  --project-directory . \
  -f ops/compose.yml \
  build --builder twenty-production --pull twenty
