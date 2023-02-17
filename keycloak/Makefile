file=keycloak-mysql.yml

up:
	sudo docker-compose  -f ${file} up -d

start:
	sudo docker-compose -f ${file} start

stop:
	sudo docker-compose -f ${file} stop

clean: stop
	docker rm `docker ps -a |grep keycloak | awk '{print $$1}'`

add-realm:
	TKN=`curl POST 'http://localhost:8899/auth/realms/master/protocol/openid-connect/token' -H "Content-Type: application/x-www-form-urlencoded" -d "username=admin" -d 'password=Pa55w0rd' -d 'grant_type=password' -d 'client_id=admin-cli' | jq -r '.access_token'` && \
 	curl POST 'http://localhost:8899/auth/admin/realms' -H "Content-Type: application/json" -H "Authorization: Bearer $$TKN" -d @./obiba-realm.json  -v && \
	curl POST 'http://localhost:8899/auth/admin/realms/obiba/users' -H "Content-Type: application/json" -H "Authorization: Bearer $$TKN" -d @./user-jimbob.json  -v && \
	curl POST 'http://localhost:8899/auth/admin/realms/obiba/users' -H "Content-Type: application/json" -H "Authorization: Bearer $$TKN" -d @./user-pperez.json  -v && \
	set TKN=

log:
	sudo docker-compose -f ${file} logs -f
