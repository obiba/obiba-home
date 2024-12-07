file=docker-compose.yml

up:
	docker compose  -f ${file} up -d

start:
	docker compose -f ${file} start

stop:
	docker compose -f ${file} stop

clean: stop
	docker rm `docker ps -a |grep keycloak | awk '{print $$1}'`

logs:
	docker compose -f ${file} logs -f
