# Quasar Upgrade & Pinia Migration - Development Effort Estimate

**Date:** May 29, 2026  
**Project:** Amber Collect  
**Prepared by:** Development Team

---

## Executive Summary

**Total Development Time: 12-19 days (2.5-4 weeks)**

**FTE Requirements:**
- **Single Developer**: 0.5-0.8 FTE for 1 month OR 1.0 FTE for 2.5-3 weeks
- **Two Developers**: 0.5 FTE × 2 for 2-3 weeks

**Conservative Estimate: 15 days (120 hours)**

---

## Current State Analysis

### Dependencies & Versions

**Current:**
- Vue: ^3.0.0 (installed: 3.2.31)
- Vuex: ^4.0.1 (installed: 4.0.2)
- Quasar: ^2.14.3
- @quasar/app-webpack: ^3.12.3
- vuex-persistedstate: ^4.1.0 (with SecureLS encryption)
- @feathersjs/vuex: ^4.0.1-pre.7

**Target:**
- Quasar: v2.16+ (LTS)
- Pinia: v2.2+
- Vue: v3.4+

### Project Scope

**Codebase Size:**
- Total Vue files: 17
- Total JavaScript files: 42
- Store files: 22 files, 477 lines of code
- Files using Vuex: 12 components + 1 mixin

**Vuex Store Structure:**
- 4 main modules: `form`, `record`, `lock`, `account`
- 1 auth module (Feathers Vuex plugin)
- Encrypted state persistence with SecureLS

**Quasar Usage:**
- 16 out of 17 Vue files use Quasar components
- 4 Quasar plugins: AppFullscreen, Notify, LocalStorage, LoadingBar
- 8 custom boot files

---

## Detailed Effort Breakdown

### Phase 1: Quasar Upgrade (Low-Medium Risk)

**Estimated Time: 2-4 days**

#### Tasks:
- Upgrade Quasar framework from 2.14.3 to latest 2.x LTS
- Update @quasar/app-webpack and @quasar/cli
- Update @quasar/extras
- Upgrade @obiba/quasar-app-extension-amber to 1.2.0
- Test all Quasar components (Notify, LocalStorage, LoadingBar, AppFullscreen)
- Check for deprecated APIs
- Update quasar.conf.js if needed
- Regression testing across all 16 components

#### Risk Assessment:
- **Low Risk** - Already on Quasar v2, incremental updates should be safe
- Minor API changes may exist in plugins
- Well-documented upgrade path

---

### Phase 2: Pinia Migration (High Complexity)

**Estimated Time: 10-15 days**

#### 2.1. Setup & Configuration (1-2 days)
- Install Pinia and pinia-plugin-persistedstate
- Configure Pinia with SecureLS encryption adapter
- Update main.js and boot files
- Configure SSR/PWA compatibility
- Setup Pinia DevTools integration

#### 2.2. Core Store Migration (3-4 days)

| Module | Complexity | Effort | Notes |
|--------|-----------|--------|-------|
| **lock** | Low | 0.5 days | Simple state, 3 getters, 3 mutations, 3 actions |
| **account** | Low | 0.5 days | Minimal state, only actions (registerUser, forgotPassword) |
| **form** | Medium | 1 day | CRF management, cache handling, async actions |
| **record** | High | 2 days | **Most complex**: lifecycle management, error tracking, in-process tracking, 7 mutations, 7 actions |

**Record Module Complexity:**
- Manages case report lifecycle (init, pause, complete, save, delete)
- Tracks synchronization state (in-process, in-error)
- Complex state dependencies and validation logic
- Critical for data integrity

#### 2.3. Feathers Auth Integration (2-3 days) - **HIGHEST RISK**
- Research Feathers + Pinia integration options
- @feathersjs/vuex is Vuex-specific with no official Pinia adapter
- **Options:**
  - Implement custom Pinia auth store mimicking Feathers Vuex behavior
  - Use Feathers client directly with Pinia stores
  - Fork/adapt community solutions if available
- Migrate authentication flow
- Update JWT token handling with LocalStorage
- Implement auth response handlers
- Test 2FA flow integration

#### 2.4. Component Updates (3-4 days)
- Replace Vuex helpers with Pinia equivalents in 12 files:
  - 11 files with `mapState` → use Pinia store getters
  - 5 files with `mapGetters` → use Pinia computed
  - 7 files with `mapActions` → use Pinia actions
  - 8 files with `$store.dispatch()` → direct Pinia action calls
  - 2 files with `$store.state` → use Pinia store state
- Migrate LockMixin.js to composable or Pinia store access
- Update router guards in boot/auth.js
- Update auto-save logic in App.vue

**Critical Files:**
- `src/App.vue` - Auto-save interval logic
- `src/pages/Login.vue` - Complex auth with 2FA
- `src/pages/CaseReport.vue` - Main form interaction
- `src/pages/Dashboard.vue` - Multiple store integrations
- `src/layouts/MainLayout.vue` - Navigation and state
- `src/boot/auth.js` - Router guards and auth flow

#### 2.5. Testing & Validation (2-3 days)
- **Unit Testing:**
  - Test each migrated Pinia store independently
  - Test encrypted state persistence with SecureLS
  - Test store action side effects
- **Integration Testing:**
  - Test authentication flow (login, logout, 2FA)
  - Test case report lifecycle (create, pause, resume, save, delete)
  - Test lock functionality
  - Test form data caching and retrieval
  - Test error state handling and recovery
- **E2E Testing:**
  - Test offline/PWA scenarios
  - Test auto-save logic reliability
  - Test concurrent operations
  - Test state restoration after refresh
- **Security Testing:**
  - Verify encrypted storage still works
  - Test JWT token handling
  - Test session management

---

## Risk Factors

### High Risk
1. **Feathers Vuex dependency** - No official Pinia adapter exists, requires custom implementation
2. **Encrypted state persistence** - Custom SecureLS integration must be preserved exactly
3. **Router guard state access** - Timing and SSR considerations with Pinia stores
4. **Complex record state management** - Critical for data integrity, complex business logic

### Medium Risk
1. **Auto-save interval logic** - Must maintain reliability, potential race conditions
2. **Multiple components accessing store simultaneously** - Need to verify reactive updates
3. **PWA service worker state** - May need special handling for offline state
4. **2FA authentication flow** - Complex async flow with multiple state transitions

### Low Risk
1. **Quasar plugin updates** - Already on modern versions, stable APIs
2. **Simple store modules** (lock, account, form) - Straightforward migration patterns
3. **Component-level Vuex usage** - Well-isolated, predictable patterns

---

## Migration Strategy Recommendations

### Option A: Gradual Migration (Recommended)

**Timeline: 3-4 weeks**

**Approach:**
1. **Week 1:** Upgrade Quasar first (standalone effort)
2. **Week 1-2:** Install Pinia alongside Vuex (both coexist)
3. **Week 2-3:** Migrate stores one by one:
   - Day 1: lock module
   - Day 2: account module
   - Day 3-4: form module
   - Day 5-6: record module
   - Day 7-9: auth module (Feathers integration)
4. **Week 3-4:** Update components incrementally
5. **Week 4:** Remove Vuex once all migrations complete
6. **Week 4:** Final testing and validation

**Pros:**
- Lower risk - can roll back individual modules
- Continuous testing and validation
- Time to address unforeseen issues
- Both state management systems run in parallel

**Cons:**
- Longer timeline
- Temporary code duplication
- Need to maintain both Vuex and Pinia temporarily

---

### Option B: Big Bang Migration

**Timeline: 2-3 weeks**

**Approach:**
1. **Week 1:** Upgrade Quasar + setup Pinia infrastructure
2. **Week 1-2:** Migrate all stores simultaneously
3. **Week 2-3:** Update all components
4. **Week 3:** Intensive testing phase

**Pros:**
- Faster completion
- No hybrid state management period
- Clean cutover

**Cons:**
- Higher risk - all or nothing approach
- Harder to isolate issues
- More intensive testing required
- Potential for missed edge cases

---

### Option C: Hybrid Approach (Not Recommended)

**Timeline: 2-3 weeks**

**Approach:**
1. Keep Vuex for Feathers auth (defer complex migration)
2. Migrate other stores to Pinia
3. Gradual auth migration later (Phase 2 project)

**Pros:**
- Defers hardest problem
- Faster initial migration

**Cons:**
- Technical debt - maintaining two state systems long-term
- Complexity in having both systems
- Still need to solve Feathers problem eventually
- Users confused by mixed patterns

---

## FTE Requirements

### Single Developer Approach (Recommended)

**Option 1: Part-Time Dedicated**
- **0.5-0.8 FTE for 1 month**
- Work 4-6 hours per day on migration
- Allows time for other priorities

**Option 2: Full-Time Sprint**
- **1.0 FTE for 2.5-3 weeks**
- Dedicated full-time effort
- Faster completion, higher focus

**Pros:**
- Consistent architectural decisions
- Single owner of migration
- Cleaner code review process
- Deep context retention

**Cons:**
- Longer calendar time (part-time option)
- Single point of knowledge
- No parallel workstreams

---

### Two Developer Approach

**Allocation: 0.5 FTE × 2 for 2-3 weeks**

**Developer A:**
- Quasar upgrade
- Lock, account, and form store migrations
- Component updates for simpler stores

**Developer B:**
- Feathers/auth integration research and implementation
- Record store migration
- Component updates for complex stores

**Pros:**
- Faster completion (parallel work)
- Knowledge sharing
- Built-in peer review
- Risk mitigation (knowledge distribution)

**Cons:**
- Requires coordination and communication
- Potential merge conflicts
- Need clear module boundaries
- More planning overhead

---

## Budget Considerations

### Time Estimates
- **Low estimate:** 12 days × 8 hours = **96 hours**
- **High estimate:** 19 days × 8 hours = **152 hours**
- **Conservative estimate:** 15 days × 8 hours = **120 hours**

### Cost Factors
- Mid-level developer rate recommended
- May need senior developer for Feathers integration (days 7-9)
- Testing resources (could be separate QA time)
- Code review time not included in estimates

### Contingency
- **Recommend: +20% buffer** for unforeseen issues
- Adjusted estimate: **14-18 days** (112-144 hours)

---

## Post-Migration Benefits

### Technical Benefits
1. **Better TypeScript support** - If/when migrating to TS
2. **Improved DevTools** - Vue DevTools 6+ with Pinia integration
3. **Simpler API** - Less boilerplate, no mutations needed
4. **Better tree-shaking** - Smaller bundle size, modular imports
5. **Composition API friendly** - Future-proof architecture
6. **Official Vue 3 recommendation** - Long-term support guaranteed

### Development Benefits
1. **Easier testing** - Pinia stores are simpler to unit test
2. **Better code organization** - Modular store design
3. **Reduced boilerplate** - ~30% less code for state management
4. **Clearer data flow** - Direct action calls, no mutation layer
5. **Better IDE support** - Improved autocomplete and type inference

### Maintenance Benefits
1. **Aligned with Vue ecosystem** - Official state management solution
2. **Active development** - Regular updates and improvements
3. **Growing community** - More resources and examples
4. **Future-proof** - Vue team commitment to Pinia

---

## Success Criteria

### Functional Requirements
- [ ] All existing functionality works identically
- [ ] Authentication flow (including 2FA) works correctly
- [ ] Case report lifecycle management functions properly
- [ ] Auto-save logic operates reliably
- [ ] Lock screen functionality works
- [ ] Form data caching and retrieval works
- [ ] Offline/PWA mode functions correctly

### Non-Functional Requirements
- [ ] Encrypted state persistence maintains security
- [ ] No performance degradation
- [ ] Bundle size same or smaller
- [ ] All Quasar plugins function correctly
- [ ] DevTools show Pinia stores properly
- [ ] No console errors or warnings

### Testing Requirements
- [ ] Unit tests pass for all stores
- [ ] Integration tests pass for auth and record flows
- [ ] E2E tests pass for critical user journeys
- [ ] Manual QA sign-off on all major features

---

## Key Files Requiring Attention

### Critical Path Files
1. `src/store/index.js` - Main store configuration, persistence setup
2. `src/boot/feathersClient.js` - Feathers Vuex integration
3. `src/boot/auth.js` - Router guards and auth flow
4. `src/App.vue` - Auto-save interval logic
5. `src/pages/Login.vue` - Complex auth with 2FA
6. `src/pages/CaseReport.vue` - Main form interaction
7. `src/store/record/*` - Most complex business logic (7 files)

### Supporting Files
- `src/pages/Dashboard.vue` - Multiple store integrations
- `src/pages/CaseReports.vue` - List management
- `src/layouts/MainLayout.vue` - Navigation and state
- `src/mixins/LockMixin.js` - Lock functionality mixin
- All 11 other Vue components using Vuex
- Service files (may need updates for Pinia actions)

---

## Recommendations

### Recommended Approach
**Gradual Migration (Option A) with Single Developer (1.0 FTE for 3 weeks)**

**Rationale:**
- Balances speed with risk mitigation
- Allows for thorough testing at each step
- Single owner maintains architectural consistency
- Can address Feathers integration complexity properly
- Budget-friendly with predictable timeline

### Phase Gate Checkpoints

**Week 1 Checkpoint:**
- Quasar upgrade complete
- All existing functionality verified
- Pinia infrastructure setup complete
- Lock and account stores migrated
- Go/No-Go decision for continuing

**Week 2 Checkpoint:**
- Form and record stores migrated
- Auth integration approach validated
- 50% of components updated
- Performance and security verified
- Go/No-Go decision for completing

**Week 3 Checkpoint:**
- All stores migrated
- All components updated
- Testing 90% complete
- Ready for production deployment

### Contingency Plan
If Feathers Vuex integration proves too complex:
1. **Fallback:** Keep auth in Vuex temporarily (Hybrid Option C)
2. **Timeline:** Defer auth migration to Phase 2 (future sprint)
3. **Benefit:** Complete 80% of migration, unblock Pinia adoption
4. **Research:** Community/vendor support for Feathers + Pinia solution

---

## Timeline Summary

### Conservative Estimate (Recommended)
**Total: 15 days (3 weeks @ 1.0 FTE)**

- Days 1-2: Quasar upgrade
- Day 3: Pinia setup
- Days 4-5: Lock, account stores
- Days 6-7: Form store
- Days 8-9: Record store
- Days 10-12: Auth/Feathers integration
- Days 13-14: Component updates
- Day 15: Final testing

### Optimistic Estimate
**Total: 12 days (2.5 weeks @ 1.0 FTE)**

- Assumes no major blockers
- Feathers integration goes smoothly
- Minimal rework needed

### Pessimistic Estimate
**Total: 19 days (4 weeks @ 1.0 FTE)**

- Assumes Feathers integration challenges
- Additional testing/rework needed
- Unforeseen compatibility issues

---

## Conclusion

This is a **medium-sized migration** with manageable complexity. The codebase is well-structured and already uses Vue 3 with some Composition API adoption, which will facilitate the Pinia migration.

**Main Complexity Drivers:**
1. Feathers Vuex integration (requires custom solution)
2. Encrypted state persistence (needs careful adaptation)
3. Record store module (complex lifecycle management)
4. 12 components with Vuex dependencies

**Risk Mitigation:**
- Gradual migration approach
- Phase gate checkpoints
- Parallel Vuex/Pinia operation during transition
- Comprehensive testing strategy
- Fallback plan for auth integration

**Confidence Level: Medium-High**
- Well-scoped project
- Clear migration path (except Feathers)
- Good existing code quality
- Active community support for Pinia

---

**Prepared by:** Development Team  
**Review Status:** Draft  
**Next Steps:** Review with stakeholders, approve approach and timeline
