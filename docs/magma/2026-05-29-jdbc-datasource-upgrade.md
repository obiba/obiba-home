# JDBC Datasource Dependencies Upgrade Plan

**Project:** Magma  
**Module:** magma-datasource-jdbc  
**Date:** May 29, 2026  
**Estimated Duration:** 2.5 days (20 hours)  
**Risk Level:** Medium

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State](#current-state)
3. [Target State](#target-state)
4. [Pre-Upgrade Checklist](#pre-upgrade-checklist)
5. [Upgrade Phases](#upgrade-phases)
6. [Testing Strategy](#testing-strategy)
7. [Rollback Plan](#rollback-plan)
8. [Post-Upgrade Validation](#post-upgrade-validation)
9. [Known Risks & Mitigation](#known-risks--mitigation)
10. [Success Criteria](#success-criteria)

---

## Executive Summary

This plan outlines the upgrade of JDBC datasource dependencies in the Magma project, specifically Liquibase Core and database drivers (PostgreSQL, MySQL, MariaDB, MS SQL Server, HSQLDB). The upgrade is structured in two phases to minimize risk:

- **Phase 1:** Conservative patch-level upgrades (Day 1)
- **Phase 2:** Full minor/major version upgrades (Day 2-3)

**Key Challenge:** The project uses Liquibase programmatically (not changelog files), requiring careful API compatibility testing.

---

## Current State

### Dependencies

| Dependency | Current Version | Location in POM |
|------------|----------------|-----------------|
| Liquibase Core | 4.26.0 | pom.xml:61 |
| PostgreSQL JDBC | 42.7.2 | pom.xml:72 |
| MySQL Connector/J | 8.4.0 | pom.xml:68 |
| MariaDB Java Client | 3.0.7 | pom.xml:65 |
| MS SQL Server JDBC | 12.10.2.jre11 | pom.xml:67 |
| HSQLDB | 2.7.1 | pom.xml:49 |
| Commons DBCP2 | 2.9.0 | pom.xml:40 |

### Code Architecture

**Liquibase Usage:**
- **No changelog files** - All changes generated programmatically
- Custom change builders in `magma-datasource-jdbc/src/main/java/org/obiba/magma/datasource/jdbc/support/`
  - `CreateTableChangeBuilder.java`
  - `AddColumnChangeBuilder.java`
  - `CreateIndexChangeBuilder.java`
  - `InsertDataChangeBuilder.java`
  - `UpdateDataChangeBuilder.java`

**Database-Specific Code:**
- `MySqlEngineVisitor.java` - MySQL-specific SQL modifications
- `PostgreSqlEngineVisitor.java` - PostgreSQL-specific SQL modifications

**Test Coverage:**
- 24 test methods across 2 test classes
- 96% pass rate (1 test currently ignored)
- DBUnit for fixtures
- Spring Test Framework
- HSQLDB in-memory for tests

### Environment

- **Java Version:** 21
- **Spring Framework:** 7.0.3
- **Build Tool:** Maven 3.x
- **Module Structure:** Multi-module Maven project (19 modules)

---

## Target State

### Phase 1: Conservative Upgrade (Recommended First Step)

| Dependency | Target Version | Rationale |
|------------|---------------|-----------|
| Liquibase Core | 4.29.2 | Latest stable 4.x, minimal breaking changes |
| PostgreSQL JDBC | 42.7.4 | Latest 42.7.x patch |
| MySQL Connector/J | 8.4.0 | Keep current (already latest 8.4.x) |
| MariaDB Java Client | 3.5.1 | Latest 3.x series |
| MS SQL Server JDBC | 12.8.1.jre11 | Latest stable 12.x for Java 11+ |
| HSQLDB | 2.7.4 | Latest 2.7.x patch |
| Commons DBCP2 | 2.12.0 | Latest stable |

### Phase 2: Full Upgrade (After Phase 1 Success)

| Dependency | Target Version | Notes |
|------------|---------------|-------|
| Liquibase Core | 4.30.0 or latest | May have breaking API changes |
| PostgreSQL JDBC | 42.8.0 or latest | Check for JDBC 4.3 changes |
| MySQL Connector/J | 9.2.0 or latest | Major version - significant changes |
| MariaDB Java Client | 3.5.1+ | Continue with 3.x or evaluate 4.x |
| MS SQL Server JDBC | 12.8.1+ | Stay in 12.x series |
| HSQLDB | 2.7.4+ | Stay in 2.7.x series |

---

## Pre-Upgrade Checklist

### 1. Environment Preparation

- [ ] Create a feature branch: `git checkout -b feature/jdbc-deps-upgrade`
- [ ] Ensure clean working directory: `git status`
- [ ] Verify current tests pass: `mvn clean test -pl magma-datasource-jdbc`
- [ ] Document current build time and test execution time
- [ ] Backup current pom.xml: `cp pom.xml pom.xml.backup`
- [ ] Backup module pom: `cp magma-datasource-jdbc/pom.xml magma-datasource-jdbc/pom.xml.backup`

### 2. Research & Documentation

- [ ] Review Liquibase 4.26.0 → 4.29.x release notes: https://github.com/liquibase/liquibase/releases
- [ ] Review Liquibase 4.29.x → 4.30.x release notes
- [ ] Check PostgreSQL JDBC driver changelog: https://jdbc.postgresql.org/changelogs/
- [ ] Check MySQL Connector/J 8.x → 9.x migration guide: https://dev.mysql.com/doc/connector-j/9.0/en/
- [ ] Review MariaDB Java Client changelog: https://mariadb.com/kb/en/about-mariadb-connector-j/
- [ ] Review MS SQL Server JDBC driver changelog: https://github.com/microsoft/mssql-jdbc/releases
- [ ] Check Java 21 compatibility for all target versions
- [ ] Review Spring 7.0.3 compatibility with new drivers

### 3. Testing Infrastructure

- [ ] Verify local HSQLDB tests work
- [ ] Set up local PostgreSQL instance (optional but recommended)
- [ ] Set up local MySQL/MariaDB instance (optional but recommended)
- [ ] Verify DBUnit version compatibility with new drivers
- [ ] Check test-spring-context.xml configurations

### 4. Stakeholder Communication

- [ ] Notify team of upgrade schedule
- [ ] Request code freeze during upgrade (if applicable)
- [ ] Prepare rollback communication plan
- [ ] Schedule code review session

---

## Upgrade Phases

### Phase 1: Conservative Patch Upgrade (Day 1 - 8-10 hours)

**Goal:** Upgrade to latest stable patch versions with minimal breaking changes.

#### Step 1.1: Update Parent POM (30 minutes)

**File:** `/home/yannick/projects/magma/pom.xml`

```bash
# Create feature branch
git checkout -b feature/jdbc-deps-upgrade

# Backup current state
cp pom.xml pom.xml.backup
```

**Changes to make:**

```xml
<!-- Line 40: Update Commons DBCP2 -->
<commons-dbcp2.version>2.12.0</commons-dbcp2.version>

<!-- Line 49: Update HSQLDB -->
<hsqldb.version>2.7.4</hsqldb.version>

<!-- Line 61: Update Liquibase (Conservative) -->
<liquibase-core.version>4.29.2</liquibase-core.version>

<!-- Line 65: Update MariaDB -->
<mariadb-connector-java.version>3.5.1</mariadb-connector-java.version>

<!-- Line 67: Update MS SQL Server (Check latest 12.x) -->
<mssql.version>12.8.1.jre11</mssql.version>

<!-- Line 68: Keep MySQL (already latest 8.4.x) -->
<mysql-connector-j.version>8.4.0</mysql-connector-j.version>

<!-- Line 72: Update PostgreSQL -->
<postgresql.version>42.7.4</postgresql.version>
```

**Verify:**
```bash
# Check for dependency conflicts
mvn dependency:tree -pl magma-datasource-jdbc

# Check for updates
mvn versions:display-dependency-updates
```

#### Step 1.2: Resolve Build Issues (1-2 hours)

```bash
# Clean and compile
mvn clean compile -pl magma-datasource-jdbc

# Look for compilation errors
# Expected issues:
# - Deprecated API warnings
# - Potential Liquibase API changes
```

**If compilation fails:**
1. Check error messages for deprecated APIs
2. Review Liquibase API changes in change builders
3. Update imports if package names changed
4. Fix deprecated method calls

**Files likely needing updates:**
- `magma-datasource-jdbc/src/main/java/org/obiba/magma/datasource/jdbc/JdbcDatasource.java`
- `magma-datasource-jdbc/src/main/java/org/obiba/magma/datasource/jdbc/JdbcValueTableWriter.java`
- `magma-datasource-jdbc/src/main/java/org/obiba/magma/datasource/jdbc/support/*.java`

#### Step 1.3: Run Unit Tests (2-3 hours)

```bash
# Run JDBC datasource tests only
mvn clean test -pl magma-datasource-jdbc

# Run full test suite
mvn clean test
```

**Expected test scenarios:**
- [ ] All 24 existing tests should pass
- [ ] No new test failures
- [ ] Test execution time within 10% of baseline

**If tests fail:**
1. Analyze stack traces for API changes
2. Check test configurations (test-spring-context.xml)
3. Verify DBUnit compatibility
4. Update test fixtures if database behavior changed
5. Fix SQL dialect issues in engine visitors

#### Step 1.4: Integration Testing (2-3 hours)

**HSQLDB (In-Memory) Tests:**
```bash
# Already covered by mvn test
# Verify all schema scenarios pass:
# - schema-meta.sql
# - schema-nometa.sql
# - schema-nometa-numids.sql
# - schema-nometa-repeatables.sql
# - schema-nometa-where.sql
```

**Optional: External Database Tests**

If you have local database instances, test manually:

**PostgreSQL:**
```bash
# Update test-spring-context.xml temporarily to use PostgreSQL
# Uncomment PostgreSQL datasource configuration
# Run tests against real PostgreSQL
mvn test -pl magma-datasource-jdbc -Dtest=JdbcDatasourceTest
```

**MySQL/MariaDB:**
```bash
# Update test-spring-context.xml temporarily to use MySQL
# Uncomment MySQL datasource configuration
# Run tests against real MySQL
mvn test -pl magma-datasource-jdbc -Dtest=JdbcDatasourceTest
```

#### Step 1.5: Code Review & Documentation (1-2 hours)

- [ ] Review all code changes
- [ ] Document any breaking changes encountered
- [ ] Update comments if API usage changed
- [ ] Create commit with detailed message

```bash
# Stage changes
git add pom.xml magma-datasource-jdbc/

# Commit with descriptive message
git commit -m "chore: upgrade JDBC dependencies (Phase 1)

- Liquibase Core: 4.26.0 → 4.29.2
- PostgreSQL JDBC: 42.7.2 → 42.7.4
- MariaDB Client: 3.0.7 → 3.5.1
- MS SQL Server JDBC: 12.10.2 → 12.8.1
- HSQLDB: 2.7.1 → 2.7.4
- Commons DBCP2: 2.9.0 → 2.12.0

All 24 tests passing. No breaking API changes encountered."
```

**Phase 1 Decision Point:**
- ✅ If all tests pass: Proceed to Phase 2
- ⚠️ If minor issues: Fix and retest
- ❌ If major issues: Rollback and reassess

---

### Phase 2: Full Minor/Major Upgrade (Day 2-3 - 10-12 hours)

**Goal:** Upgrade to latest major/minor versions with API adaptation.

**Prerequisites:**
- Phase 1 completed successfully
- All tests passing
- Code reviewed and committed

#### Step 2.1: Research Breaking Changes (2-3 hours)

**Liquibase 4.29 → 4.30+:**
- [ ] Review breaking changes in release notes
- [ ] Identify deprecated APIs used in codebase
- [ ] Check for new required dependencies
- [ ] Review API changes in Change classes

**MySQL Connector 8.x → 9.x:**
- [ ] Review migration guide: https://dev.mysql.com/doc/connector-j/9.0/en/connector-j-upgrading.html
- [ ] Check connection string format changes
- [ ] Verify authentication plugin changes
- [ ] Review JDBC 4.3 compliance changes

**Other Drivers:**
- [ ] PostgreSQL: Check for JDBC 4.3 features
- [ ] MariaDB: Evaluate 3.x → 4.x if applicable
- [ ] MS SQL Server: Check 12.x latest features

#### Step 2.2: Update Dependencies (30 minutes)

**File:** `/home/yannick/projects/magma/pom.xml`

```xml
<!-- Conservative approach: Latest stable versions as of May 2026 -->
<liquibase-core.version>4.30.0</liquibase-core.version>
<postgresql.version>42.8.0</postgresql.version>
<mysql-connector-j.version>9.2.0</mysql-connector-j.version>
<mariadb-connector-java.version>3.5.1</mariadb-connector-java.version>
<mssql.version>12.8.1.jre11</mssql.version>
```

**Note:** Check actual latest versions at upgrade time:
```bash
# Check for latest versions
mvn versions:display-dependency-updates | grep -E "(liquibase|postgresql|mysql|mariadb|mssql)"
```

#### Step 2.3: Code Adaptation (3-5 hours)

**A. Update Liquibase API Usage**

Files to review:
1. `magma-datasource-jdbc/src/main/java/org/obiba/magma/datasource/jdbc/JdbcDatasource.java`
2. `magma-datasource-jdbc/src/main/java/org/obiba/magma/datasource/jdbc/JdbcValueTableWriter.java`

Common changes needed:
```java
// Example: Check for deprecated Change constructors
// Old (4.26):
CreateTableChange createTableChange = new CreateTableChange();

// New (4.30+): May require builder pattern
CreateTableChange createTableChange = CreateTableChange.builder()
    .tableName("table_name")
    .build();
```

**B. Update Change Builders**

Files in `magma-datasource-jdbc/src/main/java/org/obiba/magma/datasource/jdbc/support/`:
- [ ] `CreateTableChangeBuilder.java` - Update Change API usage
- [ ] `AddColumnChangeBuilder.java` - Update Column API usage
- [ ] `CreateIndexChangeBuilder.java` - Update Index API usage
- [ ] `InsertDataChangeBuilder.java` - Update Insert API usage
- [ ] `UpdateDataChangeBuilder.java` - Update Update API usage

**C. Update Database Engine Visitors**

Files:
- [ ] `MySqlEngineVisitor.java` - Update for MySQL 9.x changes
- [ ] `PostgreSqlEngineVisitor.java` - Update for PostgreSQL JDBC 42.8 changes

**D. Update Connection Properties**

If MySQL Connector 9.x changes connection properties:
- [ ] Update `test-spring-context.xml` connection URLs
- [ ] Update connection property names
- [ ] Update authentication plugin configuration

#### Step 2.4: Fix Compilation Errors (1-2 hours)

```bash
# Compile and identify errors
mvn clean compile -pl magma-datasource-jdbc 2>&1 | tee compile-errors.log

# Review errors systematically
cat compile-errors.log | grep "error:"
```

**Common error patterns:**
1. Deprecated method removal
2. Package name changes
3. Method signature changes
4. New required parameters
5. Changed return types

**Fix iteratively:**
1. Fix compilation errors one file at a time
2. Commit each major fix separately
3. Document reasoning for changes

#### Step 2.5: Update Tests (2-3 hours)

```bash
# Run tests to find runtime issues
mvn clean test -pl magma-datasource-jdbc -Dsurefire.printSummary=true
```

**Expected test updates:**

**A. Update Test Configurations**
- [ ] `test-spring-context.xml` - Update connection URLs if needed
- [ ] Update DataSource bean configurations
- [ ] Update transaction manager configuration

**B. Update Test Code**
- [ ] `JdbcDatasourceTest.java` - Fix test failures
- [ ] Update assertions if behavior changed
- [ ] Update test data if database behavior changed

**C. Fix Ignored Test**
- [ ] Attempt to fix `testCreateDatasourceFromExistingDatabaseUsingMetadataTables`
- [ ] May require DBUnit configuration updates

**D. Update Test Fixtures**
- [ ] Verify DBUnit XML files compatibility
- [ ] Update schema SQL files if needed

#### Step 2.6: Integration Testing (2-3 hours)

**Full Test Suite:**
```bash
# Run all tests in the project
mvn clean test

# Check for failures in other modules
# JDBC changes shouldn't affect other modules, but verify
```

**Manual Integration Tests:**

1. **Test Schema Creation from Scratch:**
   - Create new database
   - Run JdbcDatasource initialization
   - Verify metadata tables created correctly

2. **Test Existing Database Detection:**
   - Use existing test database
   - Verify JdbcDatasource detects schema correctly
   - Verify metadata read correctly

3. **Test Write Operations:**
   - Insert test data
   - Update test data
   - Delete test data
   - Verify all operations work

4. **Test Query Operations:**
   - Read value sets
   - Query with WHERE clause
   - Test multilines support
   - Verify all read operations work

5. **Test Database-Specific Features:**
   - MySQL: Test engine type handling
   - PostgreSQL: Test schema support
   - Test SQL dialect differences

#### Step 2.7: Performance Testing (1-2 hours)

```bash
# Run tests with timing
mvn clean test -pl magma-datasource-jdbc | grep "Time elapsed"

# Compare with baseline (Phase 1 or pre-upgrade)
# Look for significant performance changes (>20% difference)
```

**Performance metrics to check:**
- [ ] Test execution time
- [ ] Schema creation time
- [ ] Query execution time
- [ ] Write operation time
- [ ] Connection pool initialization

**If performance degrades significantly:**
1. Check for new default settings in drivers
2. Review connection pool configuration
3. Check for query plan changes
4. Profile with JProfiler or similar tool

#### Step 2.8: Documentation & Commit (1 hour)

**Update documentation:**
- [ ] Document breaking changes encountered
- [ ] Document workarounds implemented
- [ ] Update README if database version requirements changed
- [ ] Create migration notes for other developers

**Commit changes:**
```bash
git add .
git commit -m "chore: upgrade JDBC dependencies to latest versions (Phase 2)

Major upgrades:
- Liquibase Core: 4.29.2 → 4.30.0
- MySQL Connector/J: 8.4.0 → 9.2.0
- PostgreSQL JDBC: 42.7.4 → 42.8.0

Breaking changes addressed:
- Updated Liquibase Change API usage in JdbcDatasource
- Updated change builders to use new Liquibase API
- Updated MySQL connector configuration for 9.x
- Fixed deprecated JDBC API calls

All 24 tests passing. Performance within acceptable range."
```

---

## Testing Strategy

### Test Levels

#### 1. Unit Tests (Automated)
**Scope:** Individual change builder classes  
**Tool:** JUnit 4  
**Coverage:** 2 test classes, 24 test methods  
**Command:** `mvn test -pl magma-datasource-jdbc`

**Tests to verify:**
- [ ] `TableUtilsTest` - String normalization
- [ ] All 24 methods in `JdbcDatasourceTest`:
  - [ ] `testCreateDatasourceFromExistingDatabase()`
  - [ ] `testCreateDatasourceFromExistingDatabaseNumIds()`
  - [ ] `testCreateDatasourceFromExistingDatabaseWithWhereClause()`
  - [ ] `testCreateDatasourceWithDetectedMultilines()`
  - [ ] `testCreateDatasourceWithTableMultilinesConf()`
  - [ ] `testCreateDatasourceWithDatasourceMultilinesConf()`
  - [ ] `testCreateDatasourceFromScratch()`
  - [ ] `testVectorSource()`
  - [ ] `testVectorSourceWithWhereClause()`
  - [ ] `testWithSettingsFactory()`
  - [ ] `testCreateWithMetadataTablesFromScratch()`
  - [ ] `testTimestamps()`
  - [ ] `testDropDatasource()`
  - [ ] `testRemoveValueSet()`
  - [ ] `testRemoveVariable()`
  - [ ] `testValueSetCount()`
  - [ ] `testNormalizedColumnNames()`
  - [ ] `testSingleLineWriterWithMetadataTables()`
  - [ ] `testSingleLineWriterWithoutMetadataTables()`
  - [ ] `testMultiLineWriterWithMetadataTables()`
  - [ ] `testMultiLineWriterWithoutMetadataTables()`

#### 2. Integration Tests (Automated)
**Scope:** Full JdbcDatasource lifecycle  
**Tool:** Spring Test + DBUnit  
**Database:** HSQLDB in-memory  
**Command:** `mvn verify -pl magma-datasource-jdbc`

**Test scenarios:**
- [ ] Schema creation from scratch
- [ ] Existing database detection
- [ ] Metadata table operations
- [ ] Multilines support
- [ ] WHERE clause filtering
- [ ] Timestamp tracking
- [ ] Write operations (insert/update/delete)
- [ ] Read operations with various configurations

#### 3. Database-Specific Tests (Manual)

**PostgreSQL:**
```bash
# Setup PostgreSQL test database
createdb magma_test

# Update test-spring-context.xml
<bean id="dataSource" class="org.apache.commons.dbcp2.BasicDataSource">
  <property name="driverClassName" value="org.postgresql.Driver"/>
  <property name="url" value="jdbc:postgresql://localhost:5432/magma_test"/>
  <property name="username" value="postgres"/>
  <property name="password" value="password"/>
</bean>

# Run tests
mvn test -pl magma-datasource-jdbc -Dtest=JdbcDatasourceTest
```

**MySQL:**
```bash
# Setup MySQL test database
mysql -u root -p -e "CREATE DATABASE magma_test;"

# Update test-spring-context.xml
<bean id="dataSource" class="org.apache.commons.dbcp2.BasicDataSource">
  <property name="driverClassName" value="com.mysql.cj.jdbc.Driver"/>
  <property name="url" value="jdbc:mysql://localhost:3306/magma_test"/>
  <property name="username" value="root"/>
  <property name="password" value="password"/>
</bean>

# Run tests
mvn test -pl magma-datasource-jdbc -Dtest=JdbcDatasourceTest
```

**MariaDB:**
```bash
# Setup MariaDB test database
mariadb -u root -p -e "CREATE DATABASE magma_test;"

# Update test-spring-context.xml
<bean id="dataSource" class="org.apache.commons.dbcp2.BasicDataSource">
  <property name="driverClassName" value="org.mariadb.jdbc.Driver"/>
  <property name="url" value="jdbc:mariadb://localhost:3306/magma_test"/>
  <property name="username" value="root"/>
  <property name="password" value="password"/>
</bean>

# Run tests
mvn test -pl magma-datasource-jdbc -Dtest=JdbcDatasourceTest
```

#### 4. Regression Tests

**Full build verification:**
```bash
# Clean build from scratch
mvn clean install

# Verify all modules build
# Check for no new warnings
# Verify all tests pass across all modules
```

**Smoke tests:**
- [ ] Create JdbcDatasource instance programmatically
- [ ] Connect to test database
- [ ] Create a simple table
- [ ] Insert test data
- [ ] Query test data
- [ ] Drop table
- [ ] Disconnect

#### 5. Performance Tests

**Baseline metrics (before upgrade):**
```bash
# Record baseline
mvn clean test -pl magma-datasource-jdbc | tee baseline-performance.log
grep "Time elapsed" baseline-performance.log > baseline-times.txt
```

**Post-upgrade metrics:**
```bash
# Record post-upgrade
mvn clean test -pl magma-datasource-jdbc | tee upgraded-performance.log
grep "Time elapsed" upgraded-performance.log > upgraded-times.txt

# Compare
diff baseline-times.txt upgraded-times.txt
```

**Acceptable thresholds:**
- Test execution time: ±10%
- Schema creation: ±15%
- Query operations: ±10%
- Write operations: ±15%

### Test Execution Checklist

**Before each phase:**
- [ ] Clean Maven repository cache: `rm -rf ~/.m2/repository/org/liquibase`
- [ ] Clean build: `mvn clean`
- [ ] Ensure no running database connections

**During testing:**
- [ ] Monitor test output for warnings
- [ ] Check for deprecated API warnings
- [ ] Watch for SQL dialect warnings
- [ ] Monitor memory usage

**After testing:**
- [ ] Review test logs for errors
- [ ] Check for flaky tests (run 3 times)
- [ ] Verify no resource leaks
- [ ] Review database logs if available

---

## Rollback Plan

### Immediate Rollback (If Critical Issues Found)

#### Option 1: Git Revert (Preferred)

```bash
# If changes not yet pushed
git reset --hard HEAD~1

# If changes already pushed
git revert <commit-hash>
git push origin feature/jdbc-deps-upgrade
```

#### Option 2: Restore from Backup

```bash
# Restore parent POM
cp pom.xml.backup pom.xml

# Restore module POM
cp magma-datasource-jdbc/pom.xml.backup magma-datasource-jdbc/pom.xml

# Clean and rebuild with old versions
mvn clean install
```

#### Option 3: Dependency Version Rollback

```bash
# Edit pom.xml and revert version properties
# Then rebuild
mvn clean install -U
```

### Rollback Decision Criteria

**Immediate rollback if:**
- [ ] More than 5 tests fail after upgrade
- [ ] Compilation errors cannot be resolved in 2 hours
- [ ] Critical production blocker discovered
- [ ] Performance degradation > 30%
- [ ] Data corruption detected in tests

**Delayed rollback if:**
- [ ] Minor test failures (1-2 tests)
- [ ] Non-critical warnings
- [ ] Performance degradation 10-30%
- [ ] Issues can be fixed within 4 hours

**No rollback if:**
- [ ] All tests pass
- [ ] Only deprecation warnings
- [ ] Performance within 10% threshold
- [ ] No breaking changes in functionality

### Rollback Testing

After rollback:
```bash
# Verify old versions restored
mvn dependency:tree -pl magma-datasource-jdbc | grep -E "(liquibase|postgresql|mysql|mariadb|mssql)"

# Run full test suite
mvn clean test

# Verify baseline performance
mvn clean test -pl magma-datasource-jdbc | grep "Time elapsed"
```

### Communication Plan for Rollback

**If rollback needed:**
1. Notify team immediately via Slack/email
2. Document reason for rollback in JDBC_UPGRADE_PLAN.md
3. Create GitHub issue with failure details
4. Schedule post-mortem meeting
5. Update estimate based on lessons learned

---

## Post-Upgrade Validation

### Validation Checklist

#### 1. Build Verification

```bash
# Clean build
mvn clean install

# Verify no warnings
mvn clean compile -pl magma-datasource-jdbc 2>&1 | grep -i "warning"

# Verify dependency convergence
mvn dependency:tree -pl magma-datasource-jdbc

# Check for dependency conflicts
mvn dependency:analyze -pl magma-datasource-jdbc
```

**Expected results:**
- [ ] No compilation errors
- [ ] No unresolved dependencies
- [ ] No dependency conflicts
- [ ] Minimal deprecation warnings

#### 2. Test Verification

```bash
# Run all tests 3 times to check for flakiness
for i in {1..3}; do
  echo "Test run $i"
  mvn clean test -pl magma-datasource-jdbc
done

# Check test coverage (if using coverage tool)
mvn clean verify -pl magma-datasource-jdbc
```

**Expected results:**
- [ ] All 24 tests pass consistently
- [ ] No flaky tests
- [ ] Test coverage maintained or improved
- [ ] No new test failures in other modules

#### 3. Code Quality Verification

```bash
# Run static analysis
mvn pmd:check -pl magma-datasource-jdbc

# Check for code smells
mvn checkstyle:check -pl magma-datasource-jdbc

# Review dependency security
mvn dependency:analyze-report -pl magma-datasource-jdbc
```

**Expected results:**
- [ ] No new PMD violations
- [ ] No new checkstyle violations
- [ ] No security vulnerabilities in new dependencies

#### 4. Performance Verification

**Compare metrics:**
- [ ] Test execution time within 10% of baseline
- [ ] Build time within 10% of baseline
- [ ] Memory usage within acceptable range

**If performance issues detected:**
1. Profile with JProfiler or YourKit
2. Check for new default settings in drivers
3. Review connection pool configuration
4. Optimize if needed

#### 5. Documentation Verification

- [ ] JDBC_UPGRADE_PLAN.md updated with actual changes
- [ ] Commit messages are clear and descriptive
- [ ] Breaking changes documented
- [ ] Migration notes created if needed
- [ ] README.md updated if database requirements changed

#### 6. Integration Verification

**Test with downstream consumers:**
- [ ] Build dependent projects if any
- [ ] Verify no breaking changes in public API
- [ ] Test with sample applications if available

### Acceptance Criteria

**Phase 1 acceptance:**
- [ ] All 24 tests pass
- [ ] No compilation errors
- [ ] No breaking changes in functionality
- [ ] Performance within 10% of baseline
- [ ] Code reviewed and approved

**Phase 2 acceptance:**
- [ ] All 24 tests pass
- [ ] No compilation errors
- [ ] All breaking changes documented and addressed
- [ ] Performance within 15% of baseline
- [ ] Code reviewed and approved
- [ ] Manual testing completed for at least 2 databases

**Final acceptance:**
- [ ] Both phases completed successfully
- [ ] Full test suite passes
- [ ] Documentation complete
- [ ] Code merged to develop branch
- [ ] Release notes updated

---

## Known Risks & Mitigation

### High Priority Risks

#### Risk 1: Liquibase API Breaking Changes

**Probability:** Medium  
**Impact:** High  
**Description:** Liquibase 4.26 → 4.30+ may introduce breaking API changes in Change classes.

**Mitigation:**
1. Thoroughly review release notes before upgrade
2. Test Phase 1 (4.29.x) first to minimize risk
3. Create wrapper classes if needed to isolate API changes
4. Consider staying on 4.29.x if 4.30+ has major breaking changes

**Contingency:**
- If API breaks significantly, stay on 4.29.x
- Create abstraction layer for Liquibase API
- Plan separate refactoring effort if needed

#### Risk 2: MySQL Connector 8.x → 9.x Breaking Changes

**Probability:** High  
**Impact:** Medium  
**Description:** MySQL Connector/J 9.x is a major version with potential breaking changes.

**Mitigation:**
1. Review migration guide thoroughly
2. Test with both MySQL and MariaDB
3. Keep 8.4.0 in Phase 1, only upgrade to 9.x in Phase 2
4. Test connection string format changes
5. Verify authentication plugin compatibility

**Contingency:**
- Stay on MySQL 8.4.x if 9.x has blocking issues
- Consider separate PR for MySQL 9.x upgrade
- Update connection properties incrementally

#### Risk 3: Database Driver Incompatibility with Java 21

**Probability:** Low  
**Impact:** High  
**Description:** Some older drivers may not be fully Java 21 compatible.

**Mitigation:**
1. Verify Java 21 compatibility for all drivers before upgrade
2. Test with Java 21 runtime
3. Check for module system (JPMS) issues
4. Review driver documentation for Java 21 support

**Contingency:**
- Use latest patch versions which typically have Java 21 fixes
- Check for alternative drivers if needed
- Report issues to driver maintainers

### Medium Priority Risks

#### Risk 4: Test Infrastructure Incompatibility

**Probability:** Medium  
**Impact:** Medium  
**Description:** DBUnit or Spring Test may have issues with new driver versions.

**Mitigation:**
1. Test incrementally
2. Update test configurations proactively
3. Consider updating DBUnit if needed
4. Review Spring 7.0.3 compatibility

**Contingency:**
- Update DBUnit to latest version
- Update Spring Test dependencies if needed
- Refactor tests to use plain JDBC if DBUnit blocks

#### Risk 5: SQL Dialect Changes

**Probability:** Low  
**Impact:** Medium  
**Description:** New driver versions may change SQL dialect or JDBC behavior.

**Mitigation:**
1. Test with real databases (PostgreSQL, MySQL)
2. Review engine visitor implementations
3. Test SQL dialect-specific code paths
4. Verify metadata queries still work

**Contingency:**
- Update MySqlEngineVisitor and PostgreSqlEngineVisitor
- Add database version detection if needed
- Create compatibility layer if required

#### Risk 6: Performance Regression

**Probability:** Low  
**Impact:** Medium  
**Description:** New versions may have different performance characteristics.

**Mitigation:**
1. Establish performance baseline before upgrade
2. Monitor performance during testing
3. Profile if issues detected
4. Review driver changelogs for performance notes

**Contingency:**
- Tune connection pool settings
- Adjust driver properties
- Rollback if regression > 30%

### Low Priority Risks

#### Risk 7: Transitive Dependency Conflicts

**Probability:** Low  
**Impact:** Low  
**Description:** New versions may bring conflicting transitive dependencies.

**Mitigation:**
1. Review dependency tree after upgrade
2. Add exclusions if needed
3. Use dependency:analyze to detect issues

**Contingency:**
- Add explicit exclusions in pom.xml
- Update dependency management section

#### Risk 8: Documentation Gaps

**Probability:** Medium  
**Impact:** Low  
**Description:** Breaking changes may not be well documented by vendors.

**Mitigation:**
1. Budget extra time for research
2. Check GitHub issues for each project
3. Test thoroughly to discover undocumented changes

**Contingency:**
- Document discoveries for future reference
- Share findings with community
- Create workarounds as needed

---

## Success Criteria

### Phase 1 Success Criteria

**Must Have:**
- [ ] All 24 tests pass
- [ ] Zero compilation errors
- [ ] Zero runtime errors
- [ ] Dependencies updated to target versions
- [ ] Code compiles and runs successfully

**Should Have:**
- [ ] Performance within 10% of baseline
- [ ] Zero deprecation warnings
- [ ] Code reviewed by at least 1 other developer
- [ ] Changes committed with clear commit message

**Nice to Have:**
- [ ] Manual testing with PostgreSQL completed
- [ ] Manual testing with MySQL completed
- [ ] Performance improvements identified

### Phase 2 Success Criteria

**Must Have:**
- [ ] All 24 tests pass
- [ ] Zero compilation errors
- [ ] Zero runtime errors
- [ ] All breaking changes documented
- [ ] Dependencies updated to latest stable versions

**Should Have:**
- [ ] Performance within 15% of baseline
- [ ] Ignored test fixed or documented why it remains ignored
- [ ] Code reviewed by at least 1 other developer
- [ ] Manual testing with at least 2 database types

**Nice to Have:**
- [ ] Performance improvements achieved
- [ ] Code quality improved
- [ ] Test coverage increased
- [ ] Technical debt reduced

### Overall Project Success Criteria

**Technical:**
- [ ] All modules build successfully
- [ ] Full test suite passes (not just JDBC module)
- [ ] No regression in other modules
- [ ] Security vulnerabilities addressed
- [ ] Dependency conflicts resolved

**Process:**
- [ ] Upgrade completed within estimated time
- [ ] No production incidents caused by upgrade
- [ ] Team trained on any breaking changes
- [ ] Documentation complete and accurate

**Business:**
- [ ] Project remains on track
- [ ] No customer impact
- [ ] Technical debt reduced
- [ ] Foundation set for future upgrades

---

## Appendix

### A. Useful Commands Reference

```bash
# Check current dependency versions
mvn dependency:tree -pl magma-datasource-jdbc | grep -E "(liquibase|postgresql|mysql|mariadb|mssql|hsqldb)"

# Check for dependency updates
mvn versions:display-dependency-updates

# Update specific dependency version
mvn versions:use-dep-version -Dincludes=org.liquibase:liquibase-core -DdepVersion=4.29.2

# Force update dependencies (clear cache)
mvn clean install -U

# Run specific test
mvn test -pl magma-datasource-jdbc -Dtest=JdbcDatasourceTest

# Run specific test method
mvn test -pl magma-datasource-jdbc -Dtest=JdbcDatasourceTest#testCreateDatasourceFromExistingDatabase

# Show test output
mvn test -pl magma-datasource-jdbc -X

# Generate dependency report
mvn dependency:analyze-report -pl magma-datasource-jdbc

# Check for security vulnerabilities
mvn dependency:analyze-report -pl magma-datasource-jdbc

# Profile tests
mvn test -pl magma-datasource-jdbc -Djava.security.egd=file:/dev/./urandom
```

### B. Key Files Reference

**Configuration Files:**
- `/home/yannick/projects/magma/pom.xml` - Parent POM with version properties (lines 40-72)
- `/home/yannick/projects/magma/magma-datasource-jdbc/pom.xml` - Module POM with dependencies
- `/home/yannick/projects/magma/magma-datasource-jdbc/src/test/resources/test-spring-context.xml` - Test database configuration

**Source Files:**
- `/home/yannick/projects/magma/magma-datasource-jdbc/src/main/java/org/obiba/magma/datasource/jdbc/JdbcDatasource.java` - Main datasource class
- `/home/yannick/projects/magma/magma-datasource-jdbc/src/main/java/org/obiba/magma/datasource/jdbc/JdbcValueTableWriter.java` - Write operations
- `/home/yannick/projects/magma/magma-datasource-jdbc/src/main/java/org/obiba/magma/datasource/jdbc/support/*Builder.java` - Change builders

**Test Files:**
- `/home/yannick/projects/magma/magma-datasource-jdbc/src/test/java/org/obiba/magma/datasource/jdbc/JdbcDatasourceTest.java` - Main test class (744 lines, 24 tests)
- `/home/yannick/projects/magma/magma-datasource-jdbc/src/test/resources/org/obiba/magma/datasource/jdbc/*.sql` - Test schemas

### C. Contact Information

**Technical Lead:** [Add name]  
**DevOps Contact:** [Add name]  
**Database Admin:** [Add name]  

**Escalation Path:**
1. Development Team Lead
2. Technical Architect
3. Engineering Manager

### D. Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-05-29 | 1.0 | OpenCode | Initial upgrade plan created |

---

## Notes

This upgrade plan is based on analysis performed on May 29, 2026. Actual latest versions should be verified at upgrade time. Adjust timeline and effort estimates based on team experience and project constraints.

**Next Steps:**
1. Review this plan with team
2. Get approval from tech lead
3. Schedule upgrade window
4. Execute Phase 1
5. Review Phase 1 results
6. Execute Phase 2 if approved
