# Docker

Use the compose file at the repository root:

```bash
docker compose up --build
docker compose --profile gpu-avatar up
```

The optional `gpu-avatar` profile targets NVIDIA Linux hosts for LiveTalking. It is not used for the Mac demo.
