#
# Agate server
#
agate_url=http://localhost:8081
username=administrator
password=password
upassword=P@ssw0rd

agate-help:
	@echo
	@echo "Seed Agate server with some users. Requires Agate python client to be installed."
	@echo
	@echo "Available make targets:"
	@echo "  seed-agate : Seed agate server"

seed-agate: seed-users

seed-users:
	agate add-user -ag $(agate_url) -u $(username) -p $(password) --name user1 --upassword $(upassword) --first-name James --last-name Watson --email user1@test.com  --groups mica-user
	agate add-user -ag $(agate_url) -u $(username) -p $(password) --name dao --upassword $(upassword) --first-name Mary --last-name Heins --email dao@test.com  --groups mica-data-access-officer
	agate add-user -ag $(agate_url) -u $(username) -p $(password) --name editor --upassword $(upassword) --first-name John --last-name Deer --email editor@test.com  --groups mica-editor
	agate add-user -ag $(agate_url) -u $(username) -p $(password) --name reviewer --upassword $(upassword) --first-name Patrick --last-name Edlinger --email reviewer@test.com  --groups mica-reviewer


seed-realms:
	agate rest -ag $(agate_url) -u $(username) -p $(password) -m POST -ct "application/json" /config/realms < ./agate/seed/realms/keycloak-realm.json
