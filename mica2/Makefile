#
# Mica2 server
#
mica_url=https://localhost:8445
username=administrator
password=password

mica_home = $(CURDIR)/target/mica_home
mica_log = ${mica_home}/logs
skipTests = false
mvn_exec = mvn -Dmaven.test.skip=${skipTests}

mica-help:
	@echo
	@echo "Seed Mica server with some networks, studies and datasets. Requires mica python client to be installed."
	@echo
	@echo "Available make targets:"
	@echo "  seed-mica : Seed mica server"

seed-mica: seed-studies seed-datasets seed-research-projects index-taxonomies

seed-studies: seed-individual-studies seed-harmonization-studies seed-people

seed-individual-studies:
	mica import-zip -mk $(mica_url) -u $(username) -p $(password) -pub ./mica2/seed/individual-studies

seed-harmonization-studies:
	mica import-zip -mk $(mica_url) -u $(username) -p $(password) -pub ./mica2/seed/harmonization-studies

seed-single-study: seed-cls-study
	mica rest -u administrator -p password -m DELETE /draft/network/ialsa

seed-cls-study:
	mica import-zip -mk $(mica_url) -u $(username) -p $(password) -pub ./mica2/seed/individual-studies/study-cls.zip
	$(call dataset-create,collected,cls-wave1)
	$(call dataset-create,collected,cls-wave2)
	$(call dataset-create,collected,cls-wave3)
	$(call dataset-create,collected,cls-wave4)

seed-cag-study:
	mica import-zip -mk $(mica_url) -u $(username) -p $(password) -pub ./mica2/seed/individual-studies/study-cag.zip
	$(call dataset-create,collected,cag-baseline)

seed-datasets: seed-collected-datasets seed-harmonized-datasets

seed-collected-datasets:
	$(call dataset-create,collected,cls-wave1)
	$(call dataset-create,collected,cls-wave2)
	$(call dataset-create,collected,cls-wave3)
	$(call dataset-create,collected,cls-wave4)
	$(call dataset-create,collected,clsa)
	$(call dataset-create,collected,fnac)
	$(call dataset-create,collected,frele)
	$(call dataset-create,collected,lbls-1978)
	$(call dataset-create,collected,lbls-1981)
	$(call dataset-create,collected,lbls-1994)
	$(call dataset-create,collected,lbls-1997)
	$(call dataset-create,collected,lbls-2000)
	$(call dataset-create,collected,lbls-2003)
	$(call dataset-create,collected,lbls-2008)
	$(call dataset-create,collected,nuage-t1)
	$(call dataset-create,collected,nuage-t2)
	$(call dataset-create,collected,nuage-t3)
	$(call dataset-create,collected,nuage-t4)
	$(call dataset-create,collected,ulsam-50)
	$(call dataset-create,collected,ulsam-60)
	$(call dataset-create,collected,ulsam-70)
	$(call dataset-create,collected,ulsam-77)
	$(call dataset-create,collected,ulsam-82)
	$(call dataset-create,collected,ulsam-88)
	$(call dataset-create,collected,lasa-1)
	$(call dataset-create,collected,lasa-2)
	$(call dataset-create,collected,lasa-3)
	$(call dataset-create,collected,ship)
	$(call dataset-create,collected,ship-trend)
	$(call dataset-create,collected,cag-baseline)

seed-harmonized-datasets:
	$(call dataset-create,harmonized,cptp-coreqx)
	$(call dataset-create,harmonized,chpt-generic-ds)

seed-people:
	find ./mica2/seed/people -type f -execdir curl -k -s -o /dev/null --show-error --fail -X POST -H "Content-Type: application/json" -H "Accept: application/json" ${mica_url}/ws/draft/persons -d @{} -u ${username}:${password} \;

seed-research-projects:
	$(call research-project-create,eczema)
	$(call research-project-create,lung-cancer)

index-taxonomies:
	mica rest -mk $(mica_url) -u $(username) -p $(password) /taxonomies/_index -m PUT

clean-mica:
	rm -rf ${mica_home}

launch-mica-debug:
	export MAVEN_OPTS=-agentlib:jdwp=transport=dt_socket,server=y,address=8002,suspend=n && \
	cd $(CURDIR)/../mica2/mica-webapp && \
	${mvn_exec} spring-boot:run -Pdev -Dspring.profiles.active=dev -DMICA_HOME="${mica_home}" -DMICA_LOG="${mica_log}"

#
# Functions
#
dataset-create = mica rest -mk $(mica_url) -u $(username) -p $(password) -m POST /draft/$(1)-datasets --content-type "application/json" < ./mica2/seed/$(1)-datasets/$(2).json && \
	mica rest -mk $(mica_url) -u $(username) -p $(password) -m PUT /draft/$(1)-dataset/$(2)/_publish

research-project-create = mica rest -mk $(mica_url) -u $(username) -p $(password) -m POST /draft/projects --content-type "application/json" < ./mica2/seed/projects/$(1).json && \
	mica rest -mk $(mica_url) -u $(username) -p $(password) -m PUT /draft/project/$(1)/_publish
