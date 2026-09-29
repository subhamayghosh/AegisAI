COMPOSE := docker-compose -f docker/docker-compose.yml --env-file .env

.PHONY: up down logs seed

up:
	$(COMPOSE) up --build

down:
	$(COMPOSE) down -v

logs:
	$(COMPOSE) logs -f

seed:
	$(COMPOSE) exec backend python /app/scripts/seed_db.py
