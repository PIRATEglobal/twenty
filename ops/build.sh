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
  --driver-opt memory=4608m,memory-swap=10g,cpu-quota=150000,cpu-period=100000,default-load=true,cgroup-parent=pirate-build.slice \
  --buildkitd-config ops/buildkitd.toml

# Buildx applies cgroup-parent only with cgroupfs; this host uses systemd.
docker create --name buildx_buildkit_twenty-production0 \
  --privileged --init --restart=no \
  --cgroup-parent=pirate-build.slice \
  --memory=4608m --memory-swap=10g --cpus=1.5 --pids-limit=512 \
  --mount type=volume,source=buildx_buildkit_twenty-production0_state,target=/var/lib/buildkit \
  moby/buildkit:buildx-stable-1 --config=/etc/buildkitd.toml >/dev/null
docker cp ops/buildkitd.toml buildx_buildkit_twenty-production0:/etc/buildkitd.toml

swap_utility() {
  docker run --rm --privileged --network=none \
    --cgroup-parent=pirate-build.slice --memory=128m --pids-limit=32 --cpus=0.25 \
    --mount type=volume,source=buildx_buildkit_twenty-production0_state,target=/state \
    postgres:16-alpine sh -c "$1"
}

cleanup_build() {
  build_status=$?
  trap - EXIT
  docker buildx stop twenty-production >/dev/null || true
  if ! swap_utility '
    set -eu
    if awk '\''$1 ~ /twenty-production-build[.]swap/ { found=1 } END { exit !found }'\'' /proc/swaps; then
      swapoff /state/twenty-production-build.swap
    fi
    rm -f /state/twenty-production-build.swap
  '; then
    echo 'Failed to clean up Twenty build swap; keep the cache volume until cleanup succeeds.' >&2
    build_status=1
  fi
  exit "$build_status"
}

trap cleanup_build EXIT
docker buildx inspect --bootstrap twenty-production >/dev/null
builder_parent=$(docker inspect --format '{{.HostConfig.CgroupParent}}' buildx_buildkit_twenty-production0)
if [ "$builder_parent" != pirate-build.slice ]; then
  echo 'Twenty builder must run outside the shared production container resource group.' >&2
  exit 1
fi
docker update --memory=4608m --memory-swap=10g --pids-limit=512 \
  buildx_buildkit_twenty-production0 >/dev/null

# The upstream frontend needs an 8 GiB heap; keep the extra capacity temporary.
swap_utility '
  set -eu
  umask 077
  if awk '\''$1 ~ /twenty-production-build[.]swap/ { found=1 } END { exit !found }'\'' /proc/swaps; then
    echo "A previous Twenty build swap is still active; clean it up before retrying." >&2
    exit 1
  fi
  rm -f /state/twenty-production-build.swap
  fallocate -l 4G /state/twenty-production-build.swap
  chmod 600 /state/twenty-production-build.swap
  mkswap /state/twenty-production-build.swap >/dev/null
  swapon /state/twenty-production-build.swap
'

# Coolify keeps runtime secrets out of the build-time environment file.
export TWENTY_PUBLIC_URL=https://crm.i.pirate.builders
export TWENTY_APP_SECRET=build-validation-only
export PG_DATABASE_URL=postgres://build:build@localhost:5432/default

docker compose \
  --env-file /artifacts/build-time.env \
  --project-directory . \
  -f ops/compose.yml \
  build --builder twenty-production --pull twenty
