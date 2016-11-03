#
# Drupal
#
drupal_version = 7.51
obiba-progressbar-version=1.0.0
obiba-timeline-version=1.0.1
drupal_dir=$(CURDIR)/target/drupal

#
# Mysql db access
#
db_name = drupal
db_user = root
db_pass = 1234
db_host = localhost

#
# www settings
#
www=html/drupal

#
# Snapshot branches
#
mica-drupal7_branch=master
agate-drupal7_branch=master
bootstrap-drupal7_branch=master
mica_js_dependencies_branch=master

drupal-help:
	@echo
	@echo "Build Mica Drupal7 site with modules/themes: obiba_mica, obiba_agate, obiba_protobuf, obiba_bootstrap."
	@echo
	@echo "Available make targets:"
	@echo "  drupal         : Clean & setup Drupal with a symlink to Mica modules/themes in target directory and import drupal.sql"
	@echo "  drupal-release : Clean & setup Drupal with released Mica modules/themes in target directory and import drupal.sql"
	@echo "  less-css-target : Compile less of specific project exp : less-css-target project=bootstrap-drupal7"
	@echo

# Install drupal with mica/agate related modules for development
drupal: drupal-clean setup-drupal enable-modules setup-dependencies update-composer-autoload cc

# Install drupal with mica/agate related modules for production
drupal-release: drupal-clean setup-drupal-release enable-modules-release-branch update-composer-autoload cc

# Install drupal with mica/agate related modules from snapshot
drupal-snapshot: drupal-clean setup-drupal-snapshot

# Prepare drupal installation, for making a clean reference SQL database
drupal-empty: drupal-clean setup-drupal-empty

drupal-clean:
	rm -rf $(drupal_dir)

#
# Drupal
#

# Empty
setup-drupal-empty: prepare-drupal  create-sql www

# Development
setup-drupal: prepare-drupal  import-sql finalize-drupal www

prepare-drupal: prepare-install-drupal prepare-drupal-modules

prepare-drupal-modules:
	ln -s $(CURDIR)/../mica-drupal7 $(drupal_dir)/sites/all/modules/obiba_mica && \
	ln -s $(CURDIR)/../bootstrap-drupal7 $(drupal_dir)/sites/all/themes/obiba_bootstrap && \
	ln -s $(CURDIR)/../agate-drupal7 $(drupal_dir)/sites/all/modules/obiba_agate

# Release
setup-drupal-release: prepare-install-drupal import-sql finalize-drupal www

# Snapshot (docker for nigthly)
setup-drupal-snapshot: prepare-drupal-snapshot import-sql finalize-drupal www

prepare-drupal-snapshot: prepare-install-drupal prepare-drupal-modules-snapshot

prepare-drupal-modules-snapshot:
	$(call github-install,mica-drupal7,$(mica-drupal7_branch),modules,obiba_mica)
	$(call github-install,agate-drupal7,$(agate-drupal7_branch),modules,obiba_agate)
	$(call github-install,bootstrap-drupal7,$(bootstrap-drupal7_branch),themes,obiba_bootstrap)

prepare-install-drupal:
	drush make --prepare-install drupal/drupal-basic.make $(drupal_dir) && \
	chmod -R a+w $(drupal_dir)

www:
	sudo rm -f /var/www/$(www) && \
	sudo ln -s $(drupal_dir) /var/www/$(www) && \
	sudo chown -R www-data:www-data /var/www/$(www)

dump-sql:
	mysqldump -h $(db_host) -u $(db_user) --password=$(db_pass) --hex-blob $(db_name) --result-file="drupal/drupal-$(drupal_version).sql"

create-sql:
	mysql -h $(db_host) -u $(db_user) --password=$(db_pass) -e "drop database if exists $(db_name); create database $(db_name);"

import-sql: create-sql import-sql-tables

import-sql-tables:
	mysql -h $(db_host) -u $(db_user) --password=$(db_pass) $(db_name) < "drupal/drupal-$(drupal_version).sql"

finalize-drupal: settings htaccess

settings:
	sed  's/@db_name@/$(db_name)/g' drupal/settings.php | sed 's/@db_user@/$(db_user)/g' | sed 's/@db_pass@/$(db_pass)/g'  | sed 's/@db_host@/$(db_host)/g' > $(drupal_dir)/sites/default/settings.php

htaccess:
	cp drupal/.htaccess $(drupal_dir)

#
# Mica related Modules
#

enable-modules: enable-bootstrap enable-mica enable-angular-app enable-data-access enable-research-project enable-charts-google

# Enabled modules for a snapshot environment
enable-modules-snapshot: enable-bootstrap enable-mica enable-data-access enable-research-project enable-graphics enable-charts-google download-dependencies-snapshot update-composer-autoload jquery_update

# Enabled modules for a production environment
enable-modules-release-branch: enable-bootstrap enable-mica enable-data-access enable-graphics enable-charts-google download-dependencies update-composer-autoload jquery_update

enable-charts-google:
	cd $(drupal_dir) && \
	drush en -y charts_google

enable-bootstrap:
	cd $(drupal_dir) && \
	drush dl -y bootstrap && \
	drush en -y bootstrap && \
	drush en -y obiba_bootstrap

enable-mica:
	cd $(drupal_dir) && \
	drush en -y obiba_mica

enable-angular-app:
	cd $(drupal_dir)/sites/all/modules/obiba_mica && \
	bower --allow-root install && \
	rm -rf $(drupal_dir)/sites/all/libraries/angular-app && \
	mkdir $(drupal_dir)/sites/all/libraries/angular-app && \
	mv bower_components/* $(drupal_dir)/sites/all/libraries/angular-app/ && \
	rm -rf  bower_components

enable-data-access:
	cd $(drupal_dir) && \
	drush en -y obiba_mica_data_access_request

enable-research-project:
	cd $(drupal_dir) && \
	drush en -y obiba_mica_research_project

enable-graphics:
	cd $(drupal_dir) && \
	drush en -y obiba_mica_graphic

deploy-dependencies:
	$(call deploy-js-libraries-by-branch,$(mica_js_dependencies_branch))

#
# Dependencies
#

download-dependencies:
	cd $(drupal_dir) && \
	drush download-mica-dependencies

download-dependencies-snapshot:
	cd $(drupal_dir) && \
	drush download-mica-dependencies --repo=$(mica_js_dependencies_branch)

setup-dependencies: jquery_update datatables obiba-progressbar obiba-timeline

chart-enable:
	cd $(drupal_dir) && \
	drush highcharts-download && \
	drush en -y charts_highcharts

jquery_update:
	cd $(drupal_dir) && \
	drush vset -y --format=string jquery_update_jquery_version 1.10 && \
	drush vset -y --format=string jquery_update_jquery_admin_version 1.10

datatables: datatables-download datatables-plugins-download

datatables-download:
	cd $(drupal_dir) && \
	drush datatables-download

datatables-plugins-download:
	cd $(drupal_dir) && \
	drush datatables-plugins-download

obiba-progressbar:
	cd $(drupal_dir) && \
	drush obiba-progressbar-download $(obiba-progressbar-version)

obiba-timeline:
	cd $(drupal_dir) && \
	drush mica-study-timeline-download $(obiba-timeline-version)

#
# Additional modules
#

enable-autologout:
	cd $(drupal_dir) && \
	drush dl -y autologout && \
	drush en -y autologout && \
	drush vset -y autologout_redirect_url "<front>" && \
	drush vset -y autologout_no_dialog TRUE

#
# Development tools
#

install-devel: devel devel-patch enable-devel cc

less-css:
	lessc $(CURDIR)/../bootstrap-drupal7/less/obiba.less $(CURDIR)/../bootstrap-drupal7/css/obiba.css --source-map=$(CURDIR)/../bootstrap-drupal7/css/obiba-commun.css.map --source-map-basepath=$(CURDIR)/../bootstrap-drupal7/css
	lessc $(CURDIR)/../bootstrap-drupal7/less/style.less $(CURDIR)/../bootstrap-drupal7/css/style.css --source-map=$(CURDIR)/../bootstrap-drupal7/css/style.css.map --source-map-basepath=$(CURDIR)/../bootstrap-drupal7/css

less-css-target:
	$(call less-css-project,$(project))

less-css-project = lessc $(CURDIR)/../$(1)/less/obiba.less $(CURDIR)/../$(1)/css/obiba.css && \
	lessc $(CURDIR)/../$(1)/less/style.less $(CURDIR)/../$(1)/css/custom.css

enable-obiba:
	ln -s $(CURDIR)/../obiba_bootstrap $(drupal_dir)/sites/all/themes/obiba_bootstrap && \
	cd $(drupal_dir) && \
	drush vset -y --format=string theme_default obiba_bootstrap

devel:
	cd $(drupal_dir) && \
	drush dl -y devel

devel-patch:
	cd $(drupal_dir) && \
	drush iq-apply-patch 2559061

enable-devel:
	cd $(drupal_dir) && \
	drush en -y devel

update-composer-autoload:
	cd $(drupal_dir) && drush composer-manager dump-autoload -o && drush cc all

cc:
	cd $(drupal_dir) && drush cc all && \
	sudo chown -R www-data:www-data .


#
# Functions
#

# Install a module/them from a github repository given a tag or a branch name
github-install = cd /tmp && rm -rf $(1)-$(2) && \
	  curl -Ls https://github.com/obiba/$(1)/archive/$(2).tar.gz  | tar -xzf - && \
	  rm -rf $(drupal_dir)/sites/all/$(3)/$(4) && \
	  mv $(1)-$(2) $(drupal_dir)/sites/all/$(3)/$(4)

# Deploy Mica-Drupal JS Libraries dependencies
deploy-js-libraries-by-branch = rm -rf /tmp/mica-drupal-js-libraries && \
	git clone https://github.com/obiba/mica-drupal-js-libraries.git /tmp/mica-drupal-js-libraries && \
	cd /tmp/mica-drupal-js-libraries && \
	git checkout $(1) && \
	(ls -d */ | xargs git rm -r) && \
	cp -r $(drupal_dir)/sites/all/libraries/* . && \
	rm -f README.txt && \
	git add . && \
	(git commit -a -m "Deploying the JavaScript libraries" && git push origin $(1)) || \
	echo "Deployment to $(1) completed."

update-composer:
	cd $(drupal_dir) && \
	drush composer-json-rebuild && \
	cd sites/default/files/composer/ && \
	composer dump-autoload -o
