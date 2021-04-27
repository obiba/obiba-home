#
# Agate server
#
agate_url=https://localhost:8444
username=administrator
password=password

agate-help:
	@echo
	@echo "Seed Agate server with some users. Requires Agate python client to be installed."
	@echo
	@echo "Available make targets:"
	@echo "  seed-agate : Seed agate server"

seed-agate: seed-users

seed-users:
	agate add-user -ag $(agate_url) -u $(username) -p $(password) --name user1 --upassword password --first-name James --last-name Watson --email user1@test.com  --groups mica-user
	agate add-user -ag $(agate_url) -u $(username) -p $(password) --name dao --upassword password --first-name Mary --last-name Heins --email dao@test.com  --groups mica-data-access-officer

seed-realms:
	agate rest -ag $(agate_url) -u $(username) -p $(password) -m POST -ct "application/json" /config/realms < ./agate/seed/realms/keycloak-realm.json
