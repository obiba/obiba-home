# Mica Admin Interface Migration Estimate

**Migration:** AngularJS → Quasar + TypeScript + JSON Forms

**Date:** May 28, 2026

**Author:** Technical Assessment

---

## Executive Summary

**Recommended Effort:** 7-8 months (2 FTEs) = **14-16 person-months**

**With Contingency:** 9-10 months (2 FTEs) = **18-20 person-months**

The schema-form to json-forms migration represents the critical path and highest risk, accounting for ~30-35% of total effort.

---

## Current Angular Application Analysis

### Application Scale

- **~18,300 lines** of JavaScript code
- **~9,700 lines** of HTML templates
- **267 total source files** (JS + HTML)
- **80 controllers**
- **151 services/factories**
- **23 custom directives**
- **76 route definitions**
- **27 major functional modules**

### Functional Modules Identified

- access-config
- admin
- analysis
- comment
- commons
- config
- contact
- dataset
- entity-config
- entity-revisions
- entity-sf-config
- entity-statistics-summary
- entity-taxonomy-config
- file-system
- network
- permission
- persons
- project
- project-config
- publish
- search
- share-resource
- status
- study

### Schema-Form Usage (Critical Migration Point)

- **223 schema-form references** throughout the codebase
- **27 HTML templates** using schema-form directives
- **8 custom schema-form widgets** requiring migration:
  1. `sf-localized-string` - Multi-language input fields
  2. `sf-obiba-file-upload` - File upload with Opal integration
  3. `sf-obiba-countries-ui-select` - Country selection dropdown
  4. `sf-obiba-selection-tree` - Hierarchical tree selection
  5. `sf-obiba-simple-mde` - Markdown editor (SimpleMDE)
  6. `sf-checkboxgroup` - Checkbox group widget
  7. `sf-typeahead` - Autocomplete/typeahead widget
  8. `sf-radio-group-collection` - Radio button collections

### Current Technology Stack

- AngularJS 1.6.9
- Angular Schema Form 0.8.15 (custom fork)
- Bootstrap 3.3.7
- jQuery 2.2.4
- Bower for dependency management
- Custom Obiba Angular libraries

---

## Target Architecture

### Technology Stack

✓ **Quasar Framework** 2.17.5 (Vue 3 based)
✓ **TypeScript** 5.9.3
✓ **Vue 3** 3.5.13
✓ **Pinia** 3.0.1 (State Management)
✓ **Vue Router** 4.5.0
✓ **Vue i18n** 11.3.2
✓ **Axios** 1.15.0 (HTTP client)
✓ **@obiba/quasar-app-extension-json-form** 0.1.1

### Project Status

- ✅ Quasar project initialized in `mica-ui` module
- ✅ JSON Forms extension installed
- ✅ TypeScript configured
- ✅ Basic project structure in place
- 📊 **12 pages** created (placeholder/starter)
- 📊 **10 components** created (placeholder/starter)

---

## Migration Effort Breakdown

### 1. Infrastructure & Setup ✅

**Status:** Already Complete

- Quasar project initialized
- Build configuration
- TypeScript setup
- JSON Forms extension installed
- Basic routing structure

**Estimated:** 0 weeks (done)

---

### 2. Core Architecture Migration

**Tasks:**
- Migrate 76 AngularJS routes to Vue Router
- Set up Pinia stores for state management
- Rewrite API service layer (15 service files, 359 API calls)
- Migrate authentication/authorization interceptors
- Set up HTTP interceptors for error handling
- Migrate i18n system (angular-translate → vue-i18n)
- Set up global error handling
- Configure build and deployment pipeline

**Complexity Factors:**
- AngularJS $scope → Vue 3 Composition API
- $resource → Axios + composables
- AngularJS services → Pinia stores
- Route guards migration

**Estimated:** 3-4 weeks (1 FTE)

---

### 3. Component Migration

**Tasks:**
- Convert 80 controllers to Vue components
- Migrate list views (studies, datasets, networks, projects, persons, etc.)
- Migrate detail/view pages
- Migrate edit/create forms
- Implement CRUD operations
- Convert AngularJS directives to Vue directives/composables
- Migrate UI components to Quasar components

**Component Categories:**
- **List views:** ~15 components
- **Detail views:** ~20 components
- **Edit/Create forms:** ~25 components
- **Utility components:** ~20 components

**Complexity Factors:**
- AngularJS $scope watchers → Vue reactivity
- Two-way binding patterns
- Event handling differences
- Template syntax migration

**Estimated:** 8-10 weeks (1 FTE)

---

### 4. Schema-Form to JSON Forms Migration ⚠️ CRITICAL PATH

This is the most complex and highest risk component of the migration.

#### A. Custom Renderers Development (8 widgets)

Each custom Angular Schema Form widget requires a corresponding JSON Forms renderer:

1. **Localized String Renderer** (High Complexity)
   - Multi-language input with add/remove language support
   - Language tabs/accordion interface
   - Validation per language
   - ~5-7 days

2. **File Upload Renderer** (High Complexity)
   - Opal server integration
   - Progress tracking
   - File preview
   - Drag & drop support
   - ~5-7 days

3. **Countries UI Select Renderer** (Medium Complexity)
   - Searchable dropdown
   - Country list integration
   - Localization
   - ~3-4 days

4. **Selection Tree Renderer** (High Complexity)
   - Hierarchical data structure
   - Expand/collapse nodes
   - Multi-select with checkboxes
   - Search/filter functionality
   - ~5-7 days

5. **Markdown Editor Renderer** (Medium Complexity)
   - SimpleMDE integration with Quasar
   - Preview mode
   - Toolbar configuration
   - ~3-5 days

6. **Checkbox Group Renderer** (Low Complexity)
   - Dynamic checkbox list
   - Validation
   - ~2-3 days

7. **Typeahead Renderer** (Medium Complexity)
   - Autocomplete functionality
   - Remote data source support
   - Debouncing
   - ~3-4 days

8. **Radio Group Collection Renderer** (Medium Complexity)
   - Dynamic radio groups
   - Nested structures
   - ~3-4 days

**Sub-total:** 6-8 weeks (1 FTE)

#### B. Schema Conversion (27+ forms)

**Tasks:**
- Analyze each Angular Schema Form schema
- Convert to JSON Schema format
- Convert Angular form definitions to JSON Forms UI schemas
- Map custom widget types to new renderers
- Update validation rules
- Test each converted form

**Forms to Convert:**
- Data access forms (main, preliminary, feasibility, agreement, amendment)
- Contact forms
- Study forms (general, population, DCE)
- Dataset forms
- Network forms
- Project forms
- Entity configuration forms
- Taxonomy configuration forms
- And more...

**Complexity Factors:**
- Angular Schema Form uses non-standard JSON Schema extensions
- Custom form definitions with complex layouts
- Nested object structures
- Conditional logic and dynamic forms
- Custom validation rules

**Estimated:** 4-5 weeks (1 FTE)

#### C. Form Integration

**Tasks:**
- Replace 27 form templates with JSON Forms
- Update form controllers/logic
- Integrate validation
- Connect to API services
- Handle form submission
- Error handling and user feedback
- Test all form workflows

**Estimated:** 3-4 weeks (1 FTE)

**Schema-Form Migration Subtotal:** 13-17 weeks

---

### 5. Custom Directives & Filters Migration

**Tasks:**
- Migrate 23 custom AngularJS directives
- Convert to Vue directives, composables, or components
- Migrate AngularJS filters to Vue computed properties/methods
- Update all usages throughout the application

**Example Directives to Migrate:**
- Permission/authorization directives
- Formatting directives
- UI behavior directives
- Validation directives

**Estimated:** 2-3 weeks (1 FTE)

---

### 6. Testing & QA

**Tasks:**
- Write unit tests for critical components
- Integration testing for API interactions
- E2E testing for key workflows:
  - User authentication
  - CRUD operations for all entities
  - Form submission and validation
  - File uploads
  - Search functionality
- Cross-browser testing (Chrome, Firefox, Safari, Edge)
- Responsive design testing
- Accessibility testing
- Performance testing

**Estimated:** 4-5 weeks (1 FTE)

---

### 7. Bug Fixes & Refinements

**Tasks:**
- Address bugs found during QA
- UI/UX polish and consistency
- Performance optimization
- Code refactoring
- Handle edge cases
- User feedback incorporation

**Estimated:** 3-4 weeks (1 FTE)

---

### 8. Documentation & Deployment

**Tasks:**
- Developer documentation
- Component library documentation
- API integration guide
- Deployment procedures
- CI/CD pipeline updates
- Training materials for end users
- Migration guide for data/configuration

**Estimated:** 1-2 weeks (0.5 FTE)

---

## Total Effort Estimates

### Sequential Development (Conservative)

**38-50 weeks → 9-12 months (1 FTE)**

Single developer working through all phases sequentially.

### Parallel Development (2 FTEs)

**25-35 weeks → 6-9 months (2 FTEs)**

Two developers working in parallel on independent modules.

**Total effort:** 50-70 person-weeks

### Recommended Approach

**7-8 months calendar time with 2 FTEs**

#### Team Composition

**FTE 1: Senior Frontend Developer**
- Vue 3 / Quasar expertise
- Focus: Core architecture, routing, state management, component migration
- Skills: TypeScript, Vue Composition API, Pinia

**FTE 2: Forms Specialist Developer**
- JSON Schema / JSON Forms experience
- Focus: Schema-form migration (critical path)
- Skills: JSON Schema, custom renderers, complex form logic

#### Workload Distribution

| Phase | FTE 1 | FTE 2 | Duration |
|-------|-------|-------|----------|
| Core Architecture | Lead | Support | 3-4 weeks |
| Component Migration (non-form) | Lead | - | 6-8 weeks |
| Custom Renderers | Support | Lead | 6-8 weeks |
| Schema Conversion | - | Lead | 4-5 weeks |
| Form Integration | Support | Lead | 3-4 weeks |
| Directives/Filters | Lead | - | 2-3 weeks |
| Testing & QA | Shared | Shared | 4-5 weeks |
| Bug Fixes | Shared | Shared | 3-4 weeks |
| Documentation | Shared | Shared | 1-2 weeks |

---

## Risk Analysis

### HIGH RISK ⚠️

#### 1. JSON Forms Custom Renderers Complexity

**Risk:** The 8 custom Angular Schema Form widgets have complex logic and UI interactions that may not have direct equivalents in JSON Forms.

**Impact:** Could add 2-4 weeks to the timeline

**Mitigation:**
- Build proof-of-concept for 2-3 most complex renderers first
- Validate feasibility before full commitment
- Consider alternative UI patterns if direct translation is too complex

#### 2. Schema Compatibility Issues

**Risk:** Angular Schema Form uses custom extensions and non-standard conventions that may not translate directly to JSON Schema standard.

**Impact:** Could add 1-3 weeks to schema conversion

**Mitigation:**
- Document all custom extensions used
- Create conversion utilities/scripts
- Maintain compatibility mapping document

#### 3. Hidden Dependencies

**Risk:** With 6,439 total JS files in the project, there may be complex inter-dependencies and coupling not immediately visible.

**Impact:** Could add 2-4 weeks for refactoring

**Mitigation:**
- Thorough code analysis before starting
- Incremental migration with frequent testing
- Maintain dependency graph

### MEDIUM RISK ⚠

#### 4. API Contract Changes

**Risk:** Backend APIs may need modifications during migration, requiring coordination.

**Impact:** Could add 1-2 weeks for API updates

**Mitigation:**
- Document all API contracts upfront
- Establish change management process
- Version APIs to support both old and new clients

#### 5. State Management Patterns

**Risk:** AngularJS $scope and service patterns differ significantly from Pinia stores and Vue reactivity.

**Impact:** Could add 1-2 weeks for architecture decisions

**Mitigation:**
- Design state management architecture early
- Create patterns and guidelines document
- Code review process to ensure consistency

#### 6. Missing Requirements

**Risk:** Features or requirements only discovered during migration when comparing behavior.

**Impact:** Variable, could add 2-6 weeks

**Mitigation:**
- Comprehensive functional inventory before starting
- User acceptance testing at each milestone
- Maintain feature parity checklist

### LOW RISK ✓

- Build and deployment pipeline (Quasar has good tooling)
- Component library (Quasar provides comprehensive components)
- TypeScript adoption (team experience assumed)

---

## Recommendations

### 1. Start with Schema-Form Migration Proof-of-Concept (2 weeks)

Before committing to the full migration, validate the most risky component:

**Tasks:**
- Build 2-3 custom renderers for the most complex widgets:
  - Localized String
  - Selection Tree
  - File Upload
- Convert 2-3 representative forms end-to-end
- Test in realistic scenarios
- Validate performance and user experience

**Success Criteria:**
- Custom renderers work with acceptable complexity
- Forms can be converted without major schema restructuring
- Performance is acceptable
- Development pattern is repeatable

**Go/No-Go Decision Point:** If POC reveals major blockers, consider alternatives:
- Stay with Angular Schema Form longer
- Consider alternative form libraries
- Simplify forms to reduce custom widget needs

### 2. Incremental Migration Strategy

Rather than big-bang migration:

**Phase 1:** Migrate one complete module end-to-end (e.g., Networks module)
- ~4-6 weeks
- Includes all CRUD operations
- Includes forms
- Full testing

**Phase 2:** Apply learnings and migrate next 2-3 modules
- Use refined patterns and estimates
- ~6-8 weeks

**Phase 3:** Migrate remaining modules
- Parallel development possible
- ~10-12 weeks

**Benefits:**
- Early validation of approach
- Refined estimates based on actual experience
- Reduced risk
- Ability to pivot if needed

### 3. Consider Hybrid Approach

Run both applications in parallel during transition:

**Approach:**
- Keep AngularJS app running in production
- Build new features in Quasar
- Gradually migrate existing features
- Use iframe or micro-frontend architecture if needed

**Benefits:**
- Reduces business risk
- Allows gradual rollout
- Users can be transitioned incrementally
- Fallback option if issues arise

**Drawbacks:**
- Increased maintenance burden
- Need to maintain both codebases temporarily
- More complex deployment

### 4. Budget Contingency

**Add 20-30% buffer for unknowns:**

- Base estimate: 14-16 person-months
- With 25% contingency: **17.5-20 person-months**
- Calendar time with 2 FTEs: **8.75-10 months**

**Contingency accounts for:**
- JSON Forms renderer complexity
- Unexpected schema conversion issues
- Hidden dependencies
- Team ramp-up time
- Holidays and sick time
- Requirements clarification

---

## Success Metrics

### Technical Metrics

- ✅ All 27 modules migrated
- ✅ All 76 routes working
- ✅ All 8 custom form widgets functional
- ✅ All 27+ forms converted and tested
- ✅ API integration complete (100% endpoints)
- ✅ Unit test coverage > 70%
- ✅ E2E test coverage for critical paths
- ✅ Performance: Page load < 2s, form interactions < 200ms

### Business Metrics

- ✅ Feature parity with current application
- ✅ No data loss during migration
- ✅ User acceptance testing passed
- ✅ Zero production incidents in first month
- ✅ Improved performance vs. old app
- ✅ Improved developer experience (TypeScript, modern tooling)

---

## Project Phases Summary

| Phase | Duration | FTE | Person-Weeks | Risk |
|-------|----------|-----|--------------|------|
| POC (Schema-Form) | 2 weeks | 2 | 4 | HIGH |
| Core Architecture | 3-4 weeks | 1-2 | 5-6 | MEDIUM |
| Component Migration | 8-10 weeks | 1 | 8-10 | LOW |
| Custom Renderers | 6-8 weeks | 1 | 6-8 | HIGH |
| Schema Conversion | 4-5 weeks | 1 | 4-5 | HIGH |
| Form Integration | 3-4 weeks | 1 | 3-4 | MEDIUM |
| Directives/Filters | 2-3 weeks | 1 | 2-3 | LOW |
| Testing & QA | 4-5 weeks | 2 | 8-10 | MEDIUM |
| Bug Fixes | 3-4 weeks | 2 | 6-8 | MEDIUM |
| Documentation | 1-2 weeks | 1 | 1-2 | LOW |
| **TOTAL** | **7-10 months** | **2** | **47-60** | - |

---

## Conclusion

The migration from AngularJS to Quasar + TypeScript is **feasible but significant**, with the schema-form to json-forms migration being the critical path and highest risk component.

**Recommended approach:**
1. ✅ Start with 2-week POC for JSON Forms custom renderers
2. ✅ Use 2 FTEs with complementary skill sets
3. ✅ Plan for 7-8 months base timeline
4. ✅ Add 20-30% contingency buffer
5. ✅ Use incremental migration strategy
6. ✅ Consider hybrid approach for risk mitigation

**Final estimate: 8.75-10 months with 2 FTEs (17.5-20 person-months)**

---

## Appendix: File Counts

- Total JS files in webapp: 6,439
- App JS files: ~150
- App HTML templates: ~117
- Total app source files: ~267
- Total lines of app JavaScript: ~18,300
- Total lines of app HTML: ~9,700
- Bower components (dependencies): 50+
- Custom schema-form components: 8

---

## Next Steps

1. **Review and approve estimate** with stakeholders
2. **Secure team resources** (2 FTEs)
3. **Execute 2-week POC** for JSON Forms migration
4. **Refine estimate** based on POC results
5. **Create detailed project plan** with milestones
6. **Set up project infrastructure** (repositories, CI/CD, tracking)
7. **Begin Phase 1** (Core Architecture)

---

*Document Version: 1.0*
*Date: May 28, 2026*
