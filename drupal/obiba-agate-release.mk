mica_branch_version=1.x
drupal_branch_version=7.x
tag_agate_version=1.2-rc3
branch=$(drupal_branch_version)-$(mica_branch_version)
version_agate=$(drupal_branch_version)-$(tag_agate_version)

#drupal.org repositories :
drupal_org_agate-drupal7=git.drupal.org:project/obiba_agate.git

#GitHub repositories :
gitHub_mica_agate-drupal7=https://github.com/obiba/agate-drupal7.git

#Repositories folders
git_hub=target/github_repo
git_drupal=target/git_drupal_repo

#
# Release Drupal.org
#

release-agate:
	$(call release-drupal-module,$(branch),$(drupal_org_agate-drupal7),$(version_agate),$(gitHub_mica_agate-drupal7),agate-drupal7,obiba_agate)
