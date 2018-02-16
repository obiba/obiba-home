

include mica2/Makefile
include opal/Makefile
include drupal/Makefile
include drupal/drupal-release-utilities.mk
include drupal/obiba-agate-release.mk
include drupal/obiba-mica-release.mk
include drupal/obiba-obiba-bootstrap-release.mk
include visual_regression/Makefile

help: mica-help opal-help drupal-help test-help

clean:
	rm -rf target


