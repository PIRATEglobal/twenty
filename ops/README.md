# PIRATE production deployment

Production follows the `production` branch of `PIRATEglobal/twenty`, initially
based on upstream `v2.8.3`. Keep `main` available for upstream updates; merge
customizations into `production` when they are ready to deploy.

Coolify clones the fork, reads `ops/compose.yml`, and runs `sh ops/build.sh` as
its custom Docker Compose build command. The upstream `twenty` Docker target
builds the frontend and backend into `pirate-twenty:<commit>`; both the web
server and worker use that same local image. `SOURCE_COMMIT` is supplied by
Coolify, with its include-source-commit-in-build setting enabled.

The BuildKit builder uses one build step at a time and is limited to 4.5 GiB RAM,
6 GiB total RAM/swap, and 1.5 CPUs. Its persistent cache speeds subsequent
builds. Build completion precedes replacing the running application.
Nx runs one task at a time without its daemon. After translation compilation
has built the required packages, the final frontend bundle runs directly with
Vite and a 4 GiB JavaScript heap limit.

Coolify holds runtime secrets, which are excluded from the build environment.
GitHub Actions is disabled on this fork. Deployment is managed entirely by
Coolify, through its Deploy button or its GitHub push integration.

The existing Coolify service `jgrm1k1qwpl6my1kat59f8ot` owns PostgreSQL and
Redis, including the existing scheduled database backups. The Git application
joins that service's network and binds the data directory of its existing
uploads volume. Coolify's Compose parser renames named volume references even
when marked external, so the explicit bind preserves the existing uploads.
Do not delete that service, its network, or its volumes.

Database migrations are disabled for this same-version cutover. Before an
upstream version upgrade or a customization requiring migrations, take a
consistent database/uploads backup, test the migration in isolation, and
explicitly enable migrations for the web service during the upgrade.

For rollback, redeploy a previously built commit through Coolify. Rolling
back across a database migration also requires the matching database backup.
