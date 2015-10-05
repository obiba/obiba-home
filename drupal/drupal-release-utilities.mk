#Repositories folders
git_hub=target/github_repo
git_drupal=target/git_drupal_repo


release-drupal-module = $(call create-repo,$(git_hub)) && \
	$(call clone-git-hub-repo,$(1),$(4)) && \
	$(call create-repo-drupal,$(git_drupal)) && \
	$(call tag-drupal-module,$(git_drupal),$(1),$(2),$(git_hub),$(5),$(6),$(3))

create-repo = mkdir -p $(1)

clone-git-hub-repo = cd $(git_hub) && \
	git clone -b $(1) $(2) && \
	cd ../../

create-repo-drupal = mkdir -p $(1)

tag-drupal-module = cd $(1) && \
	$(call get-drupal-module,$(2),$(3),$(6)) && \
	cd ../../ && \
	cp -r $(4)/$(5)/* $(1)/$(6)/ &&\
	cd $(1)/$(6)/ && \
	git add . && \
	echo "Enter a message for this commit?" && \
	read git_commit_msg && \
	git commit --amend -m "$$git_commit_msg" && \
	git tag $(7) && \
	git push origin tag $(7)

#
# Tag Drupal
#
get-drupal-module = echo "Enter Drupal username?" && \
	read git_username && \
	git clone -b $(1) $$git_username@$(2) && \
	cd $(3) && \
	rm -rf * && \
	cd ../
