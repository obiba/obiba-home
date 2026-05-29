# FTE Evaluation: Quasar & Pinia Upgrade for amber-visit

**Date:** 2026-05-29  
**Project:** amber-visit v1.2.2  
**Evaluator:** OpenCode Analysis

---

## Executive Summary

**Risk-Adjusted Estimate: 0.5 FTE (4 days)**

| Scenario | Development Days | FTE @ 8hr/day |
|----------|------------------|---------------|
| **Best Case** (no blockers) | 3.0 days | **0.4 FTE** |
| **Expected Case** (minor issues) | 4.0 days | **0.5 FTE** |
| **Worst Case** (significant compatibility issues) | 6.0 days | **0.75 FTE** |

---

## Current State

### Package Versions
- **Quasar**: v2.14.3 → Target: v2.19.3 (latest)
- **Pinia**: v2.0.11 → Target: v3.0.4 (latest)
- **@quasar/app-vite**: v1.7.3 → Target: v2.6.1 (latest)
- **@quasar/cli**: v2.3.0 → Target: latest
- **Vue**: v3.0.0 (already on Vue 3)
- **Vue Router**: v4.0.0 (already on v4)

### Codebase Overview
- **Build system**: Vite-based Quasar CLI
- **Store files**: 2 (auth.ts, itw.js)
- **Pages**: 12 Vue components
- **Components**: 2 custom components
- **Style**: Sass/SCSS (no Stylus dependencies)
- **API pattern**: Setup stores (Composition API)
- **State persistence**: Encrypted localStorage via secure-ls

---

## Breaking Changes Assessment

### Pinia v2.0.11 → v3.0.4

**Impact: LOW** ✅

#### Breaking Changes
- Drops Vue 2 support (not applicable - already on Vue 3)
- Requires TypeScript ≥4.5 (need to verify current version)
- Removes `PiniaStorePlugin` type (use `PiniaPlugin`)
- Removes `defineStore({ id: 'id' })` syntax (use `defineStore('id', {...})`)

#### Your Codebase Status
- ✅ Using modern `defineStore('id', {...})` syntax
- ✅ Setup stores (Composition API) already in use
- ✅ No deprecated APIs detected
- ✅ Clean store patterns

#### Changes Needed
- Minimal to none
- Verify TypeScript version ≥4.5
- Update type imports if using `PiniaStorePlugin`

---

### Quasar v2.14.3 → v2.19.3

**Impact: LOW-MEDIUM** ⚠️

#### Version Gap
- 5 minor version jumps (2.14→2.15→2.16→2.17→2.18→2.19)
- Minor versions typically have few breaking changes
- Mostly bug fixes and small feature additions

#### Your Codebase Status
- ✅ No deprecated component APIs detected
- ✅ Modern component usage throughout
- ✅ Using standard Quasar plugins (AppFullscreen, Notify, LocalStorage, LoadingBar)
- ✅ No Stylus dependencies

#### Changes Needed
- Review changelogs for each minor version
- Test Quasar components behavior
- Verify plugin compatibility

---

### @quasar/app-vite v1.7.3 → v2.6.1

**Impact: MEDIUM-HIGH** ⚠️⚠️

#### Breaking Changes (Major Version)
- Configuration file structure changes likely
- Vite plugin API updates
- Build target adjustments
- Boot file changes possible

#### Your Configuration Complexity
- Multi-platform setup (SPA, SSR, PWA, Electron, Cordova, Capacitor, BEX)
- Custom Vite plugins:
  - unplugin-auto-import
  - @intlify/vite-plugin-vue-i18n
- Custom boot files (6 total)
- Environment variable handling

#### Changes Needed
- Update quasar.config.js syntax
- Verify all build modes still work
- Test boot file initialization
- Update Vite plugin configurations

---

## Complexity Factors

### Favorable Factors (Reducing Effort) ✅

1. **Clean, modern codebase** - No deprecated APIs detected
2. **Small store count** - Only 2 Pinia stores
3. **Composition API** - Already using modern patterns
4. **Modern build system** - Already on Quasar CLI with Vite
5. **No Stylus** - Only Sass/SCSS (no migration needed)
6. **Simple Pinia setup** - Straightforward store patterns

### Risk Factors (Increasing Effort) ⚠️

1. **feathers-pinia v3.0.4** - Compatibility with Pinia v3 unknown
2. **Custom Quasar extension** - @obiba/quasar-app-extension-amber v1.1.6 compatibility unknown
3. **unplugin-auto-import v0.16.6** - May need updating for Pinia v3
4. **Encrypted localStorage** - secure-ls integration needs testing
5. **Multi-platform config** - SSR, PWA, Electron, Cordova, Capacitor all need verification
6. **TypeScript version** - Must verify ≥4.5 for Pinia v3
7. **Complex authentication** - 3 auth schemes (participant, campaign, interviewer)
8. **State persistence** - Encrypted persistence must work correctly

---

## Detailed Task Breakdown

### Phase 1: Preparation & Analysis
**Estimated Time: 0.25 days (2 hours)**

- [ ] Review complete changelogs:
  - Pinia v2.1.0 through v3.0.4
  - Quasar v2.15.0 through v2.19.3
  - @quasar/app-vite v2.0.0 through v2.6.1
- [ ] Check TypeScript version compatibility (≥4.5 required)
- [ ] Verify feathers-pinia v3.0.4 compatibility with Pinia v3
- [ ] Check @obiba/quasar-app-extension-amber compatibility
- [ ] Check pinia-plugin-persistedstate compatibility with Pinia v3
- [ ] Create git branch for upgrade work
- [ ] Document current functionality for regression testing
- [ ] Take screenshots of current UI for comparison

---

### Phase 2: Dependency Updates
**Estimated Time: 0.5 days (4 hours)**

- [ ] Create backup of package.json and lock file
- [ ] Update package.json versions:
  - [ ] pinia: ^2.0.11 → ^3.0.4
  - [ ] quasar: ^2.14.3 → ^2.19.3
  - [ ] @quasar/app-vite: ^1.7.3 → ^2.6.1
  - [ ] @quasar/cli: ^2.3.0 → latest
  - [ ] @quasar/extras: ^1.16.9 → latest
  - [ ] unplugin-auto-import: ^0.16.6 → latest (if needed)
  - [ ] @intlify/vite-plugin-vue-i18n: ^3.3.1 → latest (if needed)
- [ ] Remove node_modules and lock files
- [ ] Run fresh install (yarn/npm install)
- [ ] Resolve any peer dependency conflicts
- [ ] Document all version changes
- [ ] Verify no security vulnerabilities (yarn audit / npm audit)

---

### Phase 3: Configuration Updates
**Estimated Time: 0.5 days (4 hours)**

- [ ] Update quasar.config.js for @quasar/app-vite v2:
  - [ ] Review breaking changes in config API
  - [ ] Update build configuration syntax
  - [ ] Verify target browser compatibility settings
  - [ ] Check framework plugin configuration
- [ ] Update Vite plugin configurations:
  - [ ] Verify unplugin-auto-import still works
  - [ ] Check @intlify/vite-plugin-vue-i18n configuration
  - [ ] Update feathersPiniaAutoImport if needed
- [ ] Verify boot file configurations:
  - [ ] i18n boot file
  - [ ] axios boot file
  - [ ] feathers-pinia boot file
  - [ ] vuelidate boot file
  - [ ] recaptcha boot file
  - [ ] settings boot file
- [ ] Check environment variable handling
- [ ] Update TypeScript config if needed (tsconfig.json, jsconfig.json)
- [ ] Verify ESLint configuration compatibility

---

### Phase 4: Code Migration
**Estimated Time: 0.25 days (2 hours)**

- [ ] Review and update Pinia stores:
  - [ ] src/stores/auth.ts - verify feathers-pinia useAuth
  - [ ] src/stores/itw.js - verify feathers service calls
  - [ ] Check for any deprecated type imports
  - [ ] Verify persist option still works
- [ ] Update Pinia initialization:
  - [ ] src/modules/pinia.ts - verify createPinia()
  - [ ] Check pinia-plugin-persistedstate configuration
  - [ ] Verify SecureLS integration
- [ ] Review feathers-pinia integration:
  - [ ] src/feathers-client.ts - verify createPiniaClient
  - [ ] Check useFeathers() composable usage
  - [ ] Verify service configurations
- [ ] Update auto-import configurations:
  - [ ] Check src/auto-imports.d.ts generation
  - [ ] Verify Pinia composables are auto-imported
- [ ] Review component code for Quasar API changes:
  - [ ] Check all 12 pages
  - [ ] Review 2 custom components
  - [ ] Verify MainLayout.vue

---

### Phase 5: Testing
**Estimated Time: 1.5 days (12 hours)**

#### Development Environment Testing (2 hours)
- [ ] Run dev server (quasar dev)
- [ ] Check console for errors/warnings
- [ ] Verify hot module replacement works
- [ ] Test Vite dev server performance

#### Authentication Testing (2 hours)
- [ ] Test participant authentication flow
- [ ] Test campaign authentication flow
- [ ] Test interviewer authentication flow
- [ ] Test TOTP/2FA functionality
- [ ] Test registration flow
- [ ] Test forgot password flow
- [ ] Test password reset flow
- [ ] Test email verification flow
- [ ] Test auto-reAuthenticate on app load

#### State Management Testing (2 hours)
- [ ] Test Pinia store reactivity
- [ ] Test state persistence (encrypted localStorage)
- [ ] Test state hydration on page reload
- [ ] Test store actions and getters
- [ ] Test feathers-pinia service calls
- [ ] Test offline state handling
- [ ] Test SecureLS encryption/decryption

#### Feature Testing (2 hours)
- [ ] Test interview design loading (itwd service)
- [ ] Test interview data submission (itw service)
- [ ] Test interview workflow (all steps)
- [ ] Test form validation (@vuelidate)
- [ ] Test dynamic step rendering
- [ ] Test step visibility logic
- [ ] Test pending saves tracking
- [ ] Test form data persistence

#### UI Component Testing (2 hours)
- [ ] Test all Quasar components:
  - [ ] q-btn (39 instances)
  - [ ] q-input (14 instances)
  - [ ] q-form (6 instances)
  - [ ] q-card components
  - [ ] q-icon, q-list, q-item
  - [ ] q-dialog, q-notify
- [ ] Test responsive layouts ($q.screen)
- [ ] Test RTL support ($q.lang.rtl)
- [ ] Test locale switching
- [ ] Test Quasar plugins (Notify, LocalStorage, LoadingBar, AppFullscreen)
- [ ] Test custom @obiba/quasar-ui-amber components

#### Regression Testing (2 hours)
- [ ] Test all 12 pages:
  - [ ] LoginPage.vue
  - [ ] RegisterPage.vue
  - [ ] ForgotPasswordPage.vue
  - [ ] ResetPasswordPage.vue
  - [ ] VerifyPage.vue
  - [ ] HomePage.vue
  - [ ] InterviewStep.vue
  - [ ] ErrorNotFound.vue
  - [ ] (others as listed)
- [ ] Cross-browser testing:
  - [ ] Chrome/Edge (latest)
  - [ ] Firefox (latest)
  - [ ] Safari (latest)
- [ ] Responsive testing:
  - [ ] Desktop
  - [ ] Tablet
  - [ ] Mobile

---

### Phase 6: Build Verification
**Estimated Time: 0.5 days (4 hours)**

#### Production Builds (2 hours)
- [ ] Build for SPA (quasar build)
- [ ] Build for PWA (quasar build -m pwa)
- [ ] Build for SSR (quasar build -m ssr)
- [ ] Build for Electron (quasar build -m electron)
- [ ] Build for Cordova (quasar build -m cordova)
- [ ] Build for Capacitor (quasar build -m capacitor)

#### Build Quality Checks (1 hour)
- [ ] Analyze bundle sizes
- [ ] Check for bundle size increases
- [ ] Verify code splitting works
- [ ] Check for duplicate dependencies
- [ ] Verify tree-shaking effectiveness

#### Production Testing (1 hour)
- [ ] Test production SPA build
- [ ] Test PWA offline functionality
- [ ] Test SSR rendering (if used)
- [ ] Performance testing (Lighthouse)
- [ ] Load time measurements
- [ ] Check for console errors in production

---

### Phase 7: Documentation & Deployment
**Estimated Time: 0.5 days (4 hours)**

#### Documentation (2 hours)
- [ ] Update package.json
- [ ] Update README.md with new requirements
- [ ] Document any configuration changes
- [ ] Document any code pattern changes
- [ ] Update developer setup instructions
- [ ] Document breaking changes encountered
- [ ] Create upgrade notes for team

#### Deployment Preparation (2 hours)
- [ ] Create deployment checklist
- [ ] Prepare rollback plan
- [ ] Document environment variable requirements
- [ ] Prepare staging deployment
- [ ] Code review with team
- [ ] Create pull request
- [ ] Update CI/CD pipelines if needed

---

## Critical Dependencies to Verify

### High Priority
1. **feathers-pinia v3.0.4** 
   - Check GitHub releases for Pinia v3 support
   - Test useAuth() compatibility
   - Test service integration
   - Verify auto-import still works

2. **@obiba/quasar-app-extension-amber v1.1.6**
   - Check if update available for Quasar v2.19
   - Test makeBlitzarQuasarSchemaForm
   - Test form rendering
   - Contact maintainer if issues arise

3. **pinia-plugin-persistedstate v3.2.0**
   - Verify Pinia v3 compatibility
   - Test encrypted storage integration
   - Check SecureLS compatibility

### Medium Priority
4. **unplugin-auto-import v0.16.6**
   - Update to latest for better Pinia v3 support
   - Verify auto-imports still generate correctly

5. **@intlify/vite-plugin-vue-i18n v3.3.1**
   - Check compatibility with @quasar/app-vite v2

6. **secure-ls v1.2.6**
   - Test encryption/decryption with new Pinia version
   - Verify data migration if storage format changes

---

## Risk Mitigation Strategies

### Pre-Upgrade
1. **Create comprehensive backup**
   - Git branch
   - Database backup
   - Environment configuration backup

2. **Set up rollback plan**
   - Document rollback steps
   - Test rollback procedure
   - Prepare rollback communication plan

3. **Establish testing baseline**
   - Document current functionality
   - Take screenshots
   - Record performance metrics

### During Upgrade
1. **Incremental approach**
   - Upgrade Pinia first (isolated)
   - Then upgrade Quasar
   - Then upgrade @quasar/app-vite
   - Test thoroughly between each step

2. **Continuous testing**
   - Test after each dependency update
   - Run automated tests frequently
   - Manual smoke tests at each checkpoint

3. **Communication**
   - Keep team informed of progress
   - Report blockers immediately
   - Document issues as they arise

### Post-Upgrade
1. **Staged rollout**
   - Deploy to staging first
   - Extended staging testing period
   - Gradual production rollout

2. **Monitoring**
   - Watch error logs closely
   - Monitor performance metrics
   - Track user reports

3. **Quick response**
   - Have team available for immediate fixes
   - Keep rollback option ready
   - Prepare hotfix process

---

## Recommendations

### Approach
1. **Start with Pinia v3 upgrade first** (isolated)
   - Verify feathers-pinia compatibility
   - Test state persistence
   - Ensure authentication flows work

2. **Then upgrade Quasar** once Pinia is stable
   - Less risk of conflicting issues
   - Easier to isolate problems

3. **Finally upgrade @quasar/app-vite**
   - Most likely to have breaking changes
   - Easier to debug with stable dependencies

### Resource Allocation
- **Recommended developer**: Senior developer with Quasar/Pinia experience
- **Time allocation**: 4-5 days for experienced developer
- **Buffer**: 1-2 additional days for unexpected issues
- **Testing support**: Include QA for thorough testing

### Success Criteria
1. All authentication flows work correctly
2. State persistence works with encryption
3. All pages render without errors
4. All form submissions work
5. Build succeeds for all target platforms
6. No performance regression
7. All automated tests pass
8. No console errors in production

---

## Potential Blockers

### High Risk
1. **feathers-pinia incompatibility with Pinia v3**
   - Mitigation: Check GitHub issues, contact maintainer
   - Fallback: Stay on Pinia v2 or fork/patch feathers-pinia

2. **@obiba/quasar-app-extension-amber incompatibility**
   - Mitigation: Contact @obiba team
   - Fallback: Update extension or refactor to not use it

3. **Breaking changes in @quasar/app-vite v2**
   - Mitigation: Thorough changelog review
   - Fallback: Stay on v1 temporarily

### Medium Risk
4. **Encrypted state persistence breaks**
   - Mitigation: Test SecureLS integration early
   - Fallback: Migrate to new storage format

5. **Auto-import configuration breaks**
   - Mitigation: Update unplugin-auto-import
   - Fallback: Manual imports temporarily

6. **Build configuration incompatibility**
   - Mitigation: Review app-vite v2 migration guide
   - Fallback: Gradual config migration

---

## Cost-Benefit Analysis

### Benefits
1. **Security patches** - 18 months of security fixes
2. **Bug fixes** - Numerous bug fixes in minor versions
3. **Performance improvements** - Better Pinia v3 performance
4. **Future-proofing** - Stay current with ecosystem
5. **Developer experience** - Better TypeScript support
6. **Long-term maintainability** - Easier to hire developers familiar with current versions

### Costs
1. **Development time** - 4-5 days of senior developer time
2. **Testing time** - 1.5 days of thorough testing
3. **Risk of bugs** - Potential for introducing new issues
4. **Deployment complexity** - Need careful rollout plan

### Recommendation
**Proceed with upgrade**. The benefits outweigh the costs, especially for:
- Security improvements
- Long-term maintainability
- Developer productivity

However, **timing is important**:
- Schedule during low-traffic period
- Ensure team availability for support
- Allow adequate testing time

---

## Timeline

### Recommended Schedule (1 Week Sprint)

**Day 1: Preparation**
- Morning: Changelog review, dependency research
- Afternoon: Create branch, document baseline

**Day 2: Pinia Upgrade**
- Morning: Update Pinia, test core functionality
- Afternoon: Verify feathers-pinia integration

**Day 3: Quasar Upgrade**
- Morning: Update Quasar and extras
- Afternoon: Test components and plugins

**Day 4: App-Vite Upgrade & Testing**
- Morning: Update @quasar/app-vite, fix config
- Afternoon: Begin comprehensive testing

**Day 5: Continued Testing**
- Full day: Complete all testing phases

**Day 6: Build Verification & Documentation**
- Morning: Build all targets, verify bundles
- Afternoon: Documentation and deployment prep

**Day 7: Buffer**
- Reserve for unexpected issues or extended testing

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| Tech Lead | | | |
| Product Owner | | | |

---

## Appendix

### Useful Resources

**Pinia Migration**
- [Pinia v3 Migration Guide](https://pinia.vuejs.org/cookbook/migration-v2-v3.html)
- [Pinia v3 Release Notes](https://github.com/vuejs/pinia/releases/tag/v3.0.0)
- [Pinia v3 Changelog](https://github.com/vuejs/pinia/blob/v3/packages/pinia/CHANGELOG.md)

**Quasar Migration**
- [Quasar Upgrade Guide](https://quasar.dev/start/upgrade-guide)
- [Quasar Changelog](https://github.com/quasarframework/quasar/releases)
- [Quasar CLI with Vite Upgrade Guide](https://quasar.dev/quasar-cli-vite/upgrade-guide)

**Related Packages**
- [feathers-pinia GitHub](https://github.com/marshallswain/feathers-pinia)
- [pinia-plugin-persistedstate](https://github.com/prazdevs/pinia-plugin-persistedstate)
- [unplugin-auto-import](https://github.com/antfu/unplugin-auto-import)

### Contact Information

**Support Channels**
- Quasar Discord: https://chat.quasar.dev
- Pinia Discord: https://chat.vuejs.org
- Quasar Forum: https://forum.quasar.dev

**Project Maintainers**
- Quasar: Razvan Stoenescu (@rstoenescu)
- Pinia: Eduardo San Martin Morote (@posva)
- feathers-pinia: Marshall Thompson (@marshallswain)

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-29  
**Next Review**: After upgrade completion
