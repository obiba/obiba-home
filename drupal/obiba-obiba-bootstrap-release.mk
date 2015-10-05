mica_branch_version=1.x
drupal_branch_version=7.x
tag_bootstrap_version=1.2-rc1
branch=$(drupal_branch_version)-$(mica_branch_version)
version_obiba_bootstrap=$(drupal_branch_version)-$(tag_bootstrap_version)

#drupal.org repositories :
drupal_org_obiba_bootstrap-drupal7=git.drupal.org:project/obiba_bootstrap.git

#GitHub repositories :
gitHub_obiba_bootstrap-drupal7=https://github.com/obiba/bootstrap-drupal7.git

#Repositories folders
git_hub=target/github_repo
git_drupal=target/git_drupal_repo

#
# Release Drupal.org
#

release-obiba-bootstrap :
	$(call release-drupal-module,$(branch),$(drupal_org_obiba_bootstrap-drupal7),$(version_obiba_bootstrap),$(gitHub_obiba_bootstrap-drupal7),bootstrap-drupal7,obiba_bootstrap)
