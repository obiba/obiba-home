#
# Opal server
#
opal_url=https://localhost:8443
username=administrator
password=password
taxonomies_ref=1.0
taxonomies_key=4929750633404868
dsusername=dsuser

# Database name in opal
database=opal_data
# R server
rserver_home=/var/lib/rserver

opal-help:
	@echo
	@echo "Seed Opal server with some generated data. Requires opal python client to be installed."
	@echo
	@echo "Available make targets:"
	@echo "  seed-opal : Seed opal server"

seed-opal: seed-projects seed-tables seed-taxonomies seed-datashield seed-resources seed-auth

seed-projects:
	$(call project-create,CHPT,Mica)
	$(call project-create,CPTP,Mica)
	$(call project-create,FNAC,Mica)
	$(call project-create,CLS,Mica)
	$(call project-create,CLSA,Mica)
	$(call project-create,FRELE,Mica)
	$(call project-create,HELIAD,Mica)
	$(call project-create,LASA,Mica)
	$(call project-create,LBLS,Mica)
	$(call project-create,NuAge,Mica)
	$(call project-create,PATH,Mica)
	$(call project-create,SHIP,Mica)
	$(call project-create,ULSAM,Mica)
	$(call project-create,CaG,Mica)

seed-tables:
	$(call tables-import,CHPT)
	$(call tables-import,CPTP)
	$(call tables-import,FNAC)
	$(call tables-import,CLS)
	$(call tables-import,CLSA)
	$(call tables-import,FRELE)
	$(call tables-import,HELIAD)
	$(call tables-import,LASA)
	$(call tables-import,LBLS)
	$(call tables-import,NuAge)
	$(call tables-import,PATH)
	$(call tables-import,SHIP)
	$(call tables-import,ULSAM)
	$(call tables-import,CaG)

seed-index:
	$(call table-index,FNAC,FNAC)
	$(call table-index,CPTP,Atlantic2_coreqx)
	$(call table-index,CPTP,Atlantic_Online_coreqx)
	$(call table-index,CPTP,Bcgp-onl_coreqx)
	$(call table-index,CPTP,Bcgp-opal_coreqx)
	$(call table-index,CPTP,Bcgp-tel_coreqx)
	$(call table-index,CPTP,Cag_coreqx)
	$(call table-index,CPTP,OHS1_coreqx)
	$(call table-index,CPTP,OHS2_coreqx)
	$(call table-index,CPTP,TTP_CoreQA_coreqx)
	$(call table-index,CPTP,TTP_UHLQ_coreqx)

seed-datashield:
	$(call project-create,CNSIM,DataSHIELD)
	$(call tables-import,CNSIM)
	$(call project-create,DASIM,DataSHIELD)
	$(call tables-import,DASIM)
	$(call project-create,DISCORDANT,DataSHIELD)
	$(call tables-import,DISCORDANT)
	$(call project-create,SURVIVAL,DataSHIELD)
	$(call tables-import,SURVIVAL)
	$(call project-create,TESTING,DataSHIELD)
	$(call tables-import,TESTING)

seed-resources: seed-rsrc-resources seed-exposome-resources

seed-rsrc-resources:
	$(call project-create,RSRC,Resources)
	$(call resource-create,RSRC,GSE66351_1)
	$(call resource-create,RSRC,GSE66351_2)
	$(call resource-create,RSRC,GSE80970)
	$(call resource-create,RSRC,CNSIM1)
	$(call resource-create,RSRC,CNSIM2)
	$(call resource-create,RSRC,CNSIM3)
	$(call resource-create,RSRC,example.vcf)
	$(call resource-create,RSRC,1000G_vcf)
	$(call resource-create,RSRC,1000G_covars)
	$(call resource-create,RSRC,brge_vcf)
	$(call resource-create,RSRC,tcga_liver)
	$(call resource-create,RSRC,brge)
	$(call resource-create,RSRC,brge_plink)
	$(call resource-create,RSRC,gps_data)
	$(call resource-create,RSRC,gps_participant)
	$(call resource-create,RSRC,takeaway_gps)
	sudo mkdir -p $(rserver_home)/data
	sudo cp opal/seed/data/CNSIM2.zsav $(rserver_home)/data
	sudo cp opal/seed/data/GSE80970.Rdata $(rserver_home)/data
	$(call file-upload,opal/seed/data/CNSIM3.zip,/projects/RSRC)
	$(call file-upload,opal/seed/data/GSE80970.Rdata,/projects/RSRC)
	$(call file-upload,opal/seed/data/gps_data_final.RData,/projects/RSRC)
	$(call file-upload,opal/seed/data/gps_participant.RData,/projects/RSRC)
	$(call file-upload,opal/seed/data/takeaway_data.RData,/projects/RSRC)

seed-exposome-resources:
	$(call project-create,EXPOSOME,Resources)
	$(call resource-create,EXPOSOME,description)
	$(call resource-create,EXPOSOME,exposomeSet)
	$(call resource-create,EXPOSOME,exposures)
	$(call resource-create,EXPOSOME,phenotypes)

seed-auth: seed-user seed-perm

seed-user:
	opal rest -o $(opal_url) -u $(username) -p $(password) -ct "application/json" -m POST /system/subject-token/_current/tokens < ./opal/seed/auth/token.json
	opal user -o $(opal_url) -u $(username) -p $(password) -n $(dsusername) -upa password -a

seed-perm:
	opal perm-datashield -o $(opal_url) -u $(username) -p $(password) -s $(dsusername) -ty user -pe use -a
	opal perm-table -o $(opal_url) -u $(username) -p $(password) -s $(dsusername) -ty user -pr CNSIM -pe view -a
	opal perm-table -o $(opal_url) -u $(username) -p $(password) -s $(dsusername) -ty user -pr DASIM -pe view -a
	opal perm-table -o $(opal_url) -u $(username) -p $(password) -s $(dsusername) -ty user -pr DISCORDANT -pe view -a
	opal perm-table -o $(opal_url) -u $(username) -p $(password) -s $(dsusername) -ty user -pr SURVIVAL -pe view -a
	opal perm-table -o $(opal_url) -u $(username) -p $(password) -s $(dsusername) -ty user -pr TESTING -pe view -a
	opal rest -o $(opal_url) -u $(username) -p $(password) -m POST "/project/RSRC/permissions/resources?type=USER&permission=RESOURCES_VIEW&principal=dsuser"
	opal rest -o $(opal_url) -u $(username) -p $(password) -m POST "/project/EXPOSOME/permissions/resources?type=USER&permission=RESOURCES_VIEW&principal=dsuser"

seed-taxonomies:
	opal rest -o $(opal_url) -u $(username) -p $(password) -m POST "/system/conf/taxonomies/import/_github?user=maelstrom-research&repo=maelstrom-taxonomies&override=true&ref=$(taxonomies_ref)&key=$(taxonomies_key)"

seed-taxonomies-latest:
	$(call taxonomy-import,AreaOfInformation)
	$(call taxonomy-import,Harmonization)
	$(call taxonomy-import,AdditionalInformation)
	$(call taxonomy-import,scales/Cognition)
	$(call taxonomy-import,scales/GeneralHealth)
	$(call taxonomy-import,scales/Habits)
	$(call taxonomy-import,scales/Social)

#
# Functions
#
project-create = opal project -o $(opal_url) -u $(username) -p $(password) --name $(1) --database $(database) --tags $(2) --add && \
	opal project -o $(opal_url) -u $(username) -p $(password) --name $(1)

tables-import = opal file -o $(opal_url) -u $(username) -p $(password) -up ./opal/seed/dictionaries/$(1).zip /home/$(username) && \
	opal import-xml -o $(opal_url) -u $(username) -p $(password) -pa /home/$(username)/$(1).zip -d $(1) && \
	while [ `opal rest -o $(opal_url) -u $(username) -p $(password) -m GET /shell/commands -j | grep -ch "NOT_STARTED\|IN_PROGRESS"` -gt 0 ] ; do echo -n "."; sleep 5; done; echo "."

taxonomy-import = opal rest -o $(opal_url) -u $(username) -p $(password) -m POST "/system/conf/taxonomies/import/_github?repo=maelstrom-taxonomies&key=$(taxonomies_key)&override=true&file=$(1).yml"

table-index = opal rest -o $(opal_url) -u $(username) -p $(password) -m PUT "/datasource/$(1)/table/$(2)/index"

resource-create = sed 's/@project@/$(1)/g' ./opal/seed/resources/$(2).json | opal rest -o $(opal_url) -u $(username) -p $(password) -ct "application/json" -m POST "/project/$(1)/resources"

file-upload = opal file -o $(opal_url) -u $(username) -p $(password) --upload $(1) $(2)
