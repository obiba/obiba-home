mica_branch_version=1.x
drupal_branch_version=7.x
tag_mica_version=1.2-rc2
branch=$(drupal_branch_version)-$(mica_branch_version)
version_mica=$(drupal_branch_version)-$(tag_mica_version)

#drupal.org repositories :
drupal_org_mica-drupal7=git.drupal.org:project/obiba_mica.git

#GitHub repositories :
gitHub_mica-drupal7=https://github.com/obiba/mica-drupal7.git

#
# Release Drupal.org
#

release-mica:
	$(call release-drupal-module,$(branch),$(drupal_org_mica-drupal7),$(version_mica),$(gitHub_mica-drupal7),mica-drupal7,obiba_mica)