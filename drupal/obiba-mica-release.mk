mica_branch_version=5.x
drupal_branch_version=7.x

# next release version tag
tag_mica_version=5.3

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
