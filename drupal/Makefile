#
# Drupal
#
drupal_version = 7.39
obiba-progressbar-version=1.0.0
obiba-timeline-version=1.0

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
# Release tags
#
mica-drupal7_version=7.x-1.1.1
agate-drupal7_version=7.x-1.0.1
protobuf-drupal7_version=7.x-1.0.0
bootstrap-drupal7_version=7.x-1.0.4


drupal-help:
	@echo
	@echo "Build Mica Drupal7 site with modules/themes: obiba_mica, obiba_agate, obiba_protobuf, obiba_bootstrap."
	@echo
	@echo "Available make targets:"
	@echo "  drupal         : Clean & setup Drupal with a symlink to Mica modules/themes in target directory and import drupal.sql"
	@echo "  drupal-release : Clean & setup Drupal with released Mica modules/themes in target directory and import drupal.sql"
	@echo

# Install drupal with mica/agate related modules for development
drupal: drupal-clean setup-drupal enable-modules setup-dependencies cc

# Install drupal with mica/agate related modules from their release tags
drupal-release: drupal-clean setup-drupal-release enable-modules setup-dependencies cc

# Install drupal with mica/agate related modules from master branches
drupal-snapshot: drupal-clean setup-drupal-snapshot

# Prepare drupal installation, for making a clean reference SQL database
drupal-empty: drupal-clean setup-drupal-empty

drupal-clean:
	rm -rf target/drupal

#
# Drupal
#

# Empty
setup-drupal-empty: prepare-drupal www create-sql

# Development
setup-drupal: prepare-drupal www import-sql finalize-drupal

prepare-drupal: prepare-install-drupal
	ln -s $(CURDIR)/../mica-drupal7 $(CURDIR)/target/drupal/sites/all/modules/obiba_mica && \
	ln -s $(CURDIR)/../bootstrap-drupal7 $(CURDIR)/target/drupal/sites/all/themes/obiba_bootstrap && \
	ln -s $(CURDIR)/../agate-drupal7 $(CURDIR)/target/drupal/sites/all/modules/obiba_agate

# Snapshot (docker for nigthly)
setup-drupal-snapshot: prepare-drupal-snapshot www import-sql finalize-drupal

prepare-drupal-snapshot: prepare-install-drupal
	$(call github-install,mica-drupal7,master,modules,obiba_mica)
	$(call github-install,agate-drupal7,master,modules,obiba_agate)
	$(call github-install,bootstrap-drupal7,master,themes,obiba_bootstrap)

# Release (for demo)
setup-drupal-release: prepare-drupal-release www import-sql finalize-drupal

prepare-drupal-release: prepare-install-drupal
	$(call github-install,mica-drupal7,$(mica-drupal7_version),modules,obiba_mica)
	$(call github-install,agate-drupal7,$(agate-drupal7_version),modules,obiba_agate)
	$(call github-install,bootstrap-drupal7,$(bootstrap-drupal7_version),themes,obiba_bootstrap)

prepare-install-drupal:
	drush make --prepare-install drupal/drupal-basic.make target/drupal && \
	chmod -R a+w target/drupal
	
www:
	sudo rm -f /var/www/$(www) && \
	sudo ln -s $(CURDIR)/target/drupal /var/www/$(www) && \
	sudo chown -R www-data:www-data /var/www/$(www)

dump-sql:
	mysqldump -h $(db_host) -u $(db_user) --password=$(db_pass) --hex-blob $(db_name) --result-file="drupal/drupal-$(drupal_version).sql"

create-sql:
	mysql -h $(db_host) -u $(db_user) --password=$(db_pass) -e "drop database if exists $(db_name); create database $(db_name);"

import-sql: create-sql
	mysql -h $(db_host) -u $(db_user) --password=$(db_pass) $(db_name) < "drupal/drupal-$(drupal_version).sql"

finalize-drupal: settings htaccess

settings:
	sed  's/@db_name@/$(db_name)/g' drupal/settings.php | sed 's/@db_user@/$(db_user)/g' | sed 's/@db_pass@/$(db_pass)/g'  | sed 's/@db_host@/$(db_host)/g' > target/drupal/sites/default/settings.php

htaccess:
	cp drupal/.htaccess target/drupal

#
# Mica related Modules
#

enable-modules: enable-bootstrap enable-mica enable-angular-app enable-data-access

enable-bootstrap:
	cd target/drupal && \
	drush dl -y bootstrap && \
	drush en -y bootstrap && \
	drush en -y obiba_bootstrap

enable-mica:
	cd target/drupal && \
	drush en -y obiba_mica

enable-angular-app:
	cd target/drupal && \
	rm -rf sites/all/libraries/angular-app  && \
	drush angular-app

enable-data-access:
	cd target/drupal && \
	drush en -y obiba_mica_data_access_request

#
# Dependencies
#

setup-dependencies: datatables obiba-progressbar obiba-timeline

chart-enable:
	cd target/drupal && \
	drush highcharts-download && \
	drush en -y charts_highcharts

datatables: datatables-download datatables-plugins-download

datatables-download:
	cd target/drupal && \
	drush datatables-download

datatables-plugins-download:
	cd target/drupal && \
	drush datatables-plugins-download

obiba-progressbar:
	cd target/drupal && \
	drush obiba-progressbar-download $(obiba-progressbar-version)

obiba-timeline:
	cd target/drupal && \
	drush mica-study-timeline-download $(obiba-timeline-version)

#
# Additional modules
#

enable-autologout:
	cd target/drupal && \
	drush dl -y autologout && \
	drush en -y autologout && \
	drush vset -y autologout_redirect_url "<front>" && \
	drush vset -y autologout_no_dialog TRUE

#
# Development tools
#

less-css:
	lessc $(CURDIR)/../bootstrap-drupal7/less/style.less $(CURDIR)/../bootstrap-drupal7/css/style.css
	lessc $(CURDIR)/../bootstrap-drupal7/less/obiba.less $(CURDIR)/../bootstrap-drupal7/css/obiba.css

devel:
	cd target/drupal && \
	drush dl -y devel && \
	drush en -y devel

cc:
	cd target/drupal && drush cc all


#
# Functions
#

# Install a module/them from a github repository given a tag or a branch name
github-install = cd /tmp && rm -f $(2).zip && rm -rf $(1)-$(2) && \
	  wget -q https://github.com/obiba/$(1)/archive/$(2).zip && \
	  unzip -q $(2).zip && \
	  mv $(1)-$(2) $(CURDIR)/target/drupal/sites/all/$(3)/$(4) && \
	  rm -f $(2).zip
