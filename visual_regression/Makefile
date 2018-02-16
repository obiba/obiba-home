SHELL := /bin/bash
# BackstopJS Command helper
backstop_dir=~/projects/mica2-home/visual_regression
lagServer=1

#layout 2
scenariosSearchList=scenariosSearchList
scenariosSearchPanelNavigation=scenariosSearchPanelNavigation
scenariosNetworksListPage=scenariosNetworksListPage
scenariosCollectedDatasetsListPage=scenariosCollectedDatasetsListPage
scenariosHarmonizedDatasetsListPage=scenariosHarmonizedDatasetsListPage
scenariosHarmonizationStudiesListPage=scenariosHarmonizationStudiesListPage
scenariosCollectedStudiesListPage=scenariosCollectedStudiesListPage
#Layout 1
layout1ScenariosSearchList=layout1ScenariosSearchList
layout1ScenariosSearchQueryNavigation=layout1ScenariosSearchQueryNavigation
layout1ScenariosNetworksListPage=layout1ScenariosNetworksListPage
layout1ScenariosCollectedDatasetsListPage=layout1ScenariosCollectedDatasetsListPage
layout1ScenariosHarmonizedDatasetsListPage=layout1ScenariosHarmonizedDatasetsListPage
layout1ScenariosHarmonizationStudiesListPage=layout1ScenariosHarmonizationStudiesListPage
layout1ScenariosCollectedStudiesListPage=layout1ScenariosCollectedStudiesListPage

layout1=layout1
layout2=layout2

#dev
dev_scenario=scenariosCollectedDatasetsListPage
layout_dev=layout2
dev=dev

test-help:
	@echo
	@echo "Test inetegration installation and facilities"
	@echo
	@echo "Available make targets:"
	@echo "  install-test   : Install the test frame-work + dependecies (backstopJs)"
	@echo "  site-reference 		: Create the references test (@param  lagServer :A coefficient to delay a waits on desired screens to shots, host : the target host default : http://localhost/drupal), referenceUrl: The choosen target host : (https://localhost/release-drupal)"
	@echo "  site-test 		: test the target web site (@param  lagServer :A coefficient to delay the waits on desired screens to shots, host : the target host default : http://localhost/drupal), referenceUrl: The choosen target host : (https://localhost/release-drupal)"
	@echo "  site-report 	: Open a report for the last test (@param  host : the target host default : http://localhost/drupal), referenceUrl: The choosen target host : (https://localhost/release-drupal)"
	@echo "  test-dev 		: test a dev config the target web site (@param  lagServer :A coefficient to delay the waits on desired screens to shots, host : the target host default : http://localhost/drupal), referenceUrl: The choosen target host : (https://localhost/release-drupal), dev: optional if 'last' perform the last test scenario"
	@echo "  reference-dev 	: Create the references test using dev config (@param  lagServer :A coefficient to delay the waits on desired screens to shots, host : the target host default : http://localhost/drupal), referenceUrl: The choosen target host : (https://localhost/release-drupal)"
	@echo

install-test: 
	echo "backstopjs installtion dependecies" && \
	npm install backstopjs -g && \
	npm install  xpath-to-css 
	

site-reference:
	pushd $(backstop_dir) && \
	$(call switch-layout,$(layout1)) && \
	$(call backstop-command-$(layout1),reference,$(host),$(lagServer),$(referenceUrl)) && \
	$(call switch-layout,$(layout2)) && \
	$(call backstop-command-$(layout2),reference,$(host),$(lagServer),$(referenceUrl)) && popd

site-test:
	pushd $(backstop_dir) && \
	$(call switch-layout,$(layout2)) && \
	$(call backstop-command-$(layout2),test,$(host),$(lagServer),$(referenceUrl)) && \
	$(call switch-layout,$(layout1)) && \
	$(call backstop-command-$(layout1),test,$(host),$(lagServer),$(referenceUrl)) && popd

site-report:
	pushd $(backstop_dir) && \
	$(call backstop-command-$(layout2),openReport,$(host),$(lagServer),$(referenceUrl)) && \
	$(call backstop-command-$(layout1),openReport,$(host),$(lagServer),$(referenceUrl)) && popd

site-approve:
	pushd $(backstop_dir) && \
	backstop approve --configPath=backstop.js --scenariosSet=$(scenario).js --host=$(host) --referenceUrl=$(referenceUrl) --lagServer=$(lagServer) --testFolder=$(scenario) --layout=$(layout) && popd

reference-dev:
	pushd $(backstop_dir)  && rm -rf backstop_data/bitmaps* backstop_data/html* && \
	$(call switch-layout,$(layout)) && \
	backstop reference --configPath=backstop.js --dev=$(dev) --scenariosSet=$(dev_scenario).js --host=$(host) --referenceUrl=$(referenceUrl) --lagServer=$(lagServer) --testFolder=$(dev_scenario) --layout=$(layout_dev) && popd

test-dev:
	pushd $(backstop_dir) && \
	$(call switch-layout,$(layout_dev)) && \
	backstop test --configPath=backstop.js --dev=$(dev) --scenariosSet=$(dev_scenario).js --host=$(host) --referenceUrl=$(referenceUrl) --lagServer=$(lagServer) --testFolder=$(dev_scenario) --layout=$(layout_dev) && popd

backstop-command-layout2 = echo $(2) && \
	echo "backstopjs Test Search page scenarios" && \
	backstop $(1) --configPath=backstop.js --scenariosSet=$(scenariosSearchList).js --host=$(2) --referenceUrl=$(4) --lagServer=$(3) --testFolder=$(scenariosSearchList) --layout=$(layout2) || \
	echo "backstopjs Test Search page panel navigation scenarios" && \
	backstop $(1) --configPath=backstop.js --scenariosSet=$(scenariosSearchPanelNavigation).js --host=$(2) --referenceUrl=$(4) --lagServer=$(3) --testFolder=$(scenariosSearchPanelNavigation) --layout=$(layout2) || \
	echo "backstopjs Test Networks list page scenarios" && \
	backstop $(1) --configPath=backstop.js --scenariosSet=$(scenariosNetworksListPage).js --host=$(2) --referenceUrl=$(4) --lagServer=$(3) --testFolder=$(scenariosNetworksListPage) --layout=$(layout2) || \
	echo "backstopjs Test Collected Datasets list scenarios" && \
	backstop $(1) --configPath=backstop.js --scenariosSet=$(scenariosCollectedDatasetsListPage).js --host=$(2) --referenceUrl=$(4) --lagServer=$(3) --testFolder=$(scenariosCollectedDatasetsListPage) --layout=$(layout2) || \
	echo "backstopjs Test Harmonized Datasets list scenarios" && \
	backstop $(1) --configPath=backstop.js --scenariosSet=$(scenariosHarmonizedDatasetsListPage).js --host=$(2) --referenceUrl=$(4) --lagServer=$(3) --testFolder=$(scenariosHarmonizedDatasetsListPage) --layout=$(layout2) || \
	echo "backstopjs Test Harmonization Studies list scenarios" && \
	backstop $(1) --configPath=backstop.js --scenariosSet=$(scenariosHarmonizationStudiesListPage).js --host=$(2) --referenceUrl=$(4) --lagServer=$(3) --testFolder=$(scenariosHarmonizationStudiesListPage) --layout=$(layout2) || \
	echo "backstopjs Test Collected Studies list scenarios" && \
	backstop $(1) --configPath=backstop.js --scenariosSet=$(scenariosCollectedStudiesListPage).js --host=$(2) --referenceUrl=$(4) --lagServer=$(3) --testFolder=$(scenariosCollectedStudiesListPage) --layout=$(layout2) || \
	echo Test complete

backstop-command-layout1 = echo $(2) && \
	echo "backstopjs Test Search page scenarios" && \
	backstop $(1) --configPath=backstop.js --scenariosSet=$(layout1ScenariosSearchList).js --host=$(2) --referenceUrl=$(4) --lagServer=$(3) --testFolder=$(layout1ScenariosSearchList) --layout=$(layout1) || \
	echo "backstopjs Test Search page query navigations scenarios" && \
	backstop $(1) --configPath=backstop.js --scenariosSet=$(layout1ScenariosSearchQueryNavigation).js --host=$(2) --referenceUrl=$(4) --lagServer=$(3) --testFolder=$(layout1ScenariosSearchQueryNavigation) --layout=$(layout1) || \
	echo "backstopjs Test Networks list page scenarios" && \
	backstop $(1) --configPath=backstop.js --scenariosSet=$(layout1ScenariosNetworksListPage).js --host=$(2) --referenceUrl=$(4) --lagServer=$(3) --testFolder=$(layout1ScenariosNetworksListPage) --layout=$(layout1) || \
	echo "backstopjs Test Collected Datasets list scenarios" && \
	backstop $(1) --configPath=backstop.js --scenariosSet=$(layout1ScenariosCollectedDatasetsListPage).js --host=$(2) --referenceUrl=$(4) --lagServer=$(3) --testFolder=$(layout1ScenariosCollectedDatasetsListPage) --layout=$(layout1) || \
	echo "backstopjs Test Harmonized Datasets list scenarios" && \
	backstop $(1) --configPath=backstop.js --scenariosSet=$(layout1ScenariosHarmonizedDatasetsListPage).js --host=$(2) --referenceUrl=$(4) --lagServer=$(3) --testFolder=$(layout1ScenariosHarmonizedDatasetsListPage) --layout=$(layout1) || \
	echo "backstopjs Test Harmonization Studies list scenarios" && \
	backstop $(1) --configPath=backstop.js --scenariosSet=$(layout1ScenariosHarmonizationStudiesListPage).js --host=$(2) --referenceUrl=$(4) --lagServer=$(3) --testFolder=$(layout1ScenariosHarmonizationStudiesListPage) --layout=$(layout1) || \
	echo "backstopjs Test Collected Studies list scenarios" && \
	backstop $(1) --configPath=backstop.js --scenariosSet=$(layout1ScenariosCollectedStudiesListPage).js --host=$(2) --referenceUrl=$(4) --lagServer=$(3) --testFolder=$(layout1ScenariosCollectedStudiesListPage) --layout=$(layout1) && \
	echo Test complete

switch-layout = sed 's/@layout@/$(1)/g' config.json.layout > config.json && \
	mica rest /config -m PUT  -u administrator -p password -mk http://localhost:8082 --content-type  application/json < config.json && \
	rm -rf config.json