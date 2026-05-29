# OrientDB to H2 Migration with Spring Data JPA

**Date:** 2026-05-28  
**Approach:** Spring Data JPA (H2 embedded, PostgreSQL-ready)  
**Estimated Effort:** 6-8 weeks FTE  

## Executive Summary

Migrate Opal's configuration database from OrientDB 3.2.45 to H2 (embedded) using Spring Data JPA. This addresses OrientDB's limited support and Java 25 compatibility issues while providing a modern, maintainable persistence layer with a clear path to PostgreSQL support in the future.

## Context

### Current State

- **Database:** OrientDB 3.2.45 (embedded, document-based)
- **Usage:** Configuration and metadata storage (not primary data storage)
- **Data Model:** 13 domain classes with ~185 service integration points
- **Access Pattern:** Custom `OrientDbService` interface with JSON serialization
- **Framework:** Spring Framework 7.0.7 (classic Spring, not Spring Boot)
- **Transaction Management:** Atomikos JTA 6.0.0

### Problem

- OrientDB only receives patch releases (no active development)
- Blocks upgrade to Java 25
- No official Spring Data support for OrientDB
- Technical debt in custom ORM layer

### Requirements

1. **Migration Strategy:** Offline migration via Opal's upgrade mode
2. **Embedded Database:** Maintain low operational overhead (H2)
3. **Future Flexibility:** Enable PostgreSQL support without major refactoring
4. **Java 25 Compatibility:** Unblock Java platform upgrades

## Domain Model (13 Classes)

All classes currently extend `AbstractTimestamped` and implement `HasUniqueProperties`:

### Security & Identity
- `SubjectCredentials` - User/application credentials
- `SubjectAcl` - Access Control Lists  
- `SubjectProfile` - User profiles
- `SubjectToken` - Authentication tokens
- `Group` - User groups
- `KeyStoreState` - Keystore states

### Project & Data Management
- `Project` - Project definitions
- `Database` - Database configurations
- `ResourceReference` - Resource references
- `VCFSamplesMapping` - VCF sample mappings

### Application & Analysis
- `OpalGeneralConfig` - Application configuration
- `OpalAnalysis` - Analysis definitions
- `OpalAnalysisResult` - Analysis results

**Note:** Additional domain classes in specialized modules:
- `AppsConfig`, `AppConfig`, `PodSpec` (opal-core)
- `DataShieldProfile` (opal-datashield)
- `RSessionActivity` (opal-r)

## Technical Approach

### Phase 1: Foundation (1-1.5 weeks)

**Add Spring Data JPA Dependencies:**
```xml
<spring-data-jpa.version>4.0.x</spring-data-jpa.version>
<h2.version>2.3.232</h2.version>
<hibernate.version>7.0.x</hibernate.version>
```

**Configure JPA:**
- Create `JpaConfiguration` class with `@Configuration`
- Define `EntityManagerFactory` for H2
- Configure `JpaTransactionManager` (integrate with Atomikos JTA)
- Enable repository scanning: `@EnableJpaRepositories`
- Set up Liquibase for schema management

**Effort:** 3-5 days

### Phase 2: Domain Model Migration (1.5-2 weeks)

**Convert Domain Classes to JPA Entities:**

For each of the 13+ domain classes:
1. Add `@Entity` and `@Table` annotations
2. Add `@Id` and `@GeneratedValue` for primary keys
3. Map unique constraints using `@Column(unique=true)` or `@Table(uniqueConstraints)`
4. Handle JSON fields with `@Lob` or custom converters
5. Add `@CreatedDate` and `@LastModifiedDate` (via Spring Data JPA auditing)
6. Remove OrientDB-specific annotations/interfaces

**Example Migration:**
```java
// Before (OrientDB)
public class Project extends AbstractTimestamped implements HasUniqueProperties {
  private String name;
  private String title;
  // ...
  
  @Override
  public List<String> getUniqueProperties() {
    return List.of("name");
  }
}

// After (JPA)
@Entity
@Table(name = "projects", uniqueConstraints = {
  @UniqueConstraint(columnNames = "name")
})
@EntityListeners(AuditingEntityListener.class)
public class Project {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;
  
  @Column(nullable = false, unique = true)
  private String name;
  
  private String title;
  
  @CreatedDate
  private Date created;
  
  @LastModifiedDate
  private Date updated;
  // ...
}
```

**Effort:** 7-10 days

### Phase 3: Repository Layer (1 week)

**Create Spring Data Repositories:**

For each domain class, create a repository interface:

```java
@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {
  Optional<Project> findByName(String name);
  List<Project> findByDatabaseName(String databaseName);
  boolean existsByName(String name);
  // Additional query methods as needed
}
```

**Replace OrientDbService Usages:**
- Inject repositories instead of `OrientDbService`
- Replace `orientDbService.save(entity)` → `repository.save(entity)`
- Replace `orientDbService.list(Project.class)` → `repository.findAll()`
- Replace `orientDbService.findUnique(...)` → custom query methods
- Update ~185 integration points across 13+ service classes

**Key Services to Update:**
- `ProjectsServiceImpl`
- `SubjectCredentialsServiceImpl`
- `SubjectAclServiceImpl`
- `SubjectProfileServiceImpl`
- `DefaultDatabaseRegistry`
- `ResourceReferenceServiceImpl`
- `SubjectTokenServiceImpl`
- `PodsServiceImpl`
- `VCFSamplesMappingServiceImpl`
- `DataShieldProfileService` (opal-datashield)
- `RActivityService` (opal-r)
- `OpalAnalysisServiceImpl`
- `AppsServiceImpl`

**Effort:** 5-7 days

### Phase 4: Data Migration Tool (1.5-2 weeks)

**Create Upgrade Step:**

Implement `UpgradeStep` in opal-upgrade module:

```java
public class OrientDBToH2MigrationStep implements UpgradeStep {
  
  @Override
  public String getDescription() {
    return "Migrate configuration data from OrientDB to H2";
  }
  
  @Override
  public Version getAppliesTo() {
    return new Version(6, 0, 0); // Target version
  }
  
  @Override
  public void execute(Version currentVersion) {
    // 1. Open OrientDB database (read-only)
    // 2. Read all documents by class
    // 3. Transform to JPA entities
    // 4. Save via repositories
    // 5. Verify counts match
    // 6. Close OrientDB
  }
}
```

**Migration Logic:**
- Export all OrientDB documents using `OrientDbService.exportDatabase()`
- Parse JSON documents
- Map to JPA entities (handle ID generation, timestamps, relationships)
- Batch insert into H2 via repositories
- Verify data integrity (row counts, unique constraints, referential integrity)
- Handle edge cases (orphaned records, malformed data)

**Rollback Strategy:**
- Keep OrientDB data intact until migration verified
- Support downgrade via backup/restore

**Effort:** 7-10 days

### Phase 5: Schema Management (1 week)

**Create Liquibase Changesets:**

Generate initial schema from JPA entities:
```xml
<!-- db.changelog-master.xml -->
<changeSet id="1-create-config-tables" author="migration">
  <createTable tableName="projects">
    <column name="id" type="BIGINT" autoIncrement="true">
      <constraints primaryKey="true"/>
    </column>
    <column name="name" type="VARCHAR(255)">
      <constraints nullable="false" unique="true"/>
    </column>
    <!-- ... -->
  </createTable>
  <!-- Repeat for all 13+ tables -->
</changeSet>
```

**H2 Configuration:**
- Embedded mode: `jdbc:h2:file:${OPAL_HOME}/data/h2/opal-config`
- Auto-create schema on first startup
- Enable Liquibase validation

**PostgreSQL Readiness:**
- Ensure Liquibase changesets are database-agnostic
- Test schema generation on PostgreSQL (optional)
- Document configuration switch process

**Effort:** 4-6 days

### Phase 6: Testing & Validation (1.5-2 weeks)

**Unit Tests:**
- Test repository methods (CRUD operations, custom queries)
- Test entity mappings (persistence, retrieval, relationships)
- Mock repository interactions in service tests

**Integration Tests:**
- End-to-end service tests with embedded H2
- Transaction rollback scenarios
- Concurrent access patterns
- Unique constraint violations

**Migration Tests:**
- Create OrientDB test database with sample data
- Run migration, verify data integrity
- Test edge cases (empty database, large datasets, corrupted data)

**Regression Tests:**
- Run full Opal test suite
- Verify no functionality broken by persistence layer change
- Performance benchmarks (CRUD operations should be comparable or faster)

**Upgrade Testing:**
- Test upgrade mode from previous Opal version
- Verify automatic restart after migration
- Test rollback/downgrade scenarios

**Effort:** 7-10 days

### Phase 7: Documentation & Cleanup (3-5 days)

**Documentation:**
- Update developer documentation (persistence layer architecture)
- Migration guide for deployments
- PostgreSQL configuration instructions (for future use)
- Troubleshooting guide for common migration issues

**Code Cleanup:**
- Remove OrientDB dependencies from POMs
- Delete `OrientDbService` and `OrientDbServiceImpl`
- Remove OrientDB configuration files
- Clean up unused imports and interfaces (`HasUniqueProperties`)

**Effort:** 3-5 days

## Detailed Effort Breakdown

| Phase | Task | Effort (days) | Risk |
|-------|------|---------------|------|
| **1** | Add Spring Data JPA dependencies | 1 | Low |
| **1** | Configure JPA with H2 | 2-3 | Medium |
| **1** | Integrate with Atomikos JTA | 1-2 | Medium |
| **2** | Convert 13+ domain classes to JPA entities | 5-7 | Medium |
| **2** | Handle JSON fields and complex types | 2-3 | Medium |
| **3** | Create Spring Data repositories | 2-3 | Low |
| **3** | Update service layer (185+ usages) | 3-4 | High |
| **4** | Implement migration tool | 4-5 | High |
| **4** | Data validation and verification | 2-3 | High |
| **4** | Rollback/recovery mechanisms | 1-2 | Medium |
| **5** | Create Liquibase changesets | 2-3 | Low |
| **5** | H2 configuration and testing | 1-2 | Low |
| **5** | PostgreSQL readiness validation | 1 | Low |
| **6** | Unit tests | 3-4 | Medium |
| **6** | Integration tests | 3-4 | Medium |
| **6** | Migration testing | 2-3 | High |
| **6** | Regression testing | 2-3 | High |
| **7** | Documentation | 2-3 | Low |
| **7** | Code cleanup | 1-2 | Low |
| | **TOTAL** | **30-40 days** | **Medium-High** |

**FTE Estimate:** 6-8 weeks (1.5-2 months) for experienced Java/Spring developer

## Risk Assessment

### High Risks

1. **Transaction Management Complexity**
   - **Risk:** Atomikos JTA may conflict with JPA transactions
   - **Mitigation:** Thorough testing of transaction boundaries, rollback scenarios
   
2. **Service Layer Updates (~185 integration points)**
   - **Risk:** Breaking existing functionality during refactoring
   - **Mitigation:** Incremental migration, comprehensive test coverage

3. **Data Migration Integrity**
   - **Risk:** Data loss or corruption during OrientDB → H2 migration
   - **Mitigation:** Extensive validation, keep OrientDB backup, support rollback

### Medium Risks

4. **JPA Entity Mapping**
   - **Risk:** JSON fields, complex relationships may not map cleanly to relational model
   - **Mitigation:** Custom converters, denormalization where needed

5. **Performance Changes**
   - **Risk:** H2 performance characteristics differ from OrientDB
   - **Mitigation:** Benchmark critical operations, optimize queries

### Low Risks

6. **Spring Data Learning Curve**
   - **Risk:** Team unfamiliar with Spring Data patterns
   - **Mitigation:** Spring Data JPA is well-documented, strong community support

## Benefits

### Immediate Benefits
- **Java 25 Compatibility:** Unblocks platform upgrade
- **Active Maintenance:** H2 and Spring Data JPA actively maintained
- **Reduced Code:** Eliminate ~600 lines of custom ORM code
- **Better Testing:** Spring Data test utilities superior to custom approach

### Future Benefits
- **PostgreSQL Support:** Configuration-only change (no code changes)
- **Modern Stack:** Aligns with Spring Framework 7.x best practices
- **Easier Onboarding:** Standard JPA patterns vs. custom OrientDB layer
- **Performance:** Potential performance improvements with H2/PostgreSQL

## PostgreSQL Migration Path

Once H2 migration is complete, switching to PostgreSQL requires only configuration changes:

```xml
<!-- pom.xml -->
<dependency>
  <groupId>org.postgresql</groupId>
  <artifactId>postgresql</artifactId>
  <version>42.7.11</version>
</dependency>
```

```properties
# application.properties
spring.datasource.url=jdbc:postgresql://localhost:5432/opal_config
spring.datasource.username=opal
spring.datasource.password=secret
spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect
```

**No Java code changes required.**

## Alternatives Considered

### Alternative A: Minimal Replacement (JDBC + Liquibase)
- **Timeline:** 3-4 weeks
- **Pros:** Faster, lower risk
- **Cons:** Maintains technical debt, PostgreSQL migration requires significant rework
- **Decision:** Rejected - doesn't address long-term maintainability

### Alternative C: Hybrid Spring Data (JPA + MongoDB)
- **Timeline:** 8-10 weeks  
- **Pros:** Full flexibility for H2/PostgreSQL/MongoDB
- **Cons:** Over-engineering, longer timeline
- **Decision:** Rejected - YAGNI principle, MongoDB support not currently needed

## Success Criteria

1. ✅ All OrientDB dependencies removed from project
2. ✅ 13+ domain classes successfully converted to JPA entities
3. ✅ All 185+ service integration points updated
4. ✅ Data migration tool successfully migrates existing OrientDB databases
5. ✅ Full test suite passes (unit, integration, regression)
6. ✅ Upgrade mode works correctly with automatic restart
7. ✅ H2 embedded database performs at comparable or better levels
8. ✅ PostgreSQL configuration documented and validated
9. ✅ Zero data loss during migration
10. ✅ Java 25 compatibility achieved

## Timeline

**Start Date:** TBD  
**Target Completion:** 6-8 weeks from start  

### Milestones
- **Week 1-2:** Foundation + Domain Model Migration
- **Week 3-4:** Repository Layer + Data Migration Tool
- **Week 5-6:** Schema Management + Testing
- **Week 7-8:** Final Testing + Documentation + Cleanup

## Conclusion

The Spring Data JPA approach provides the optimal balance between immediate needs (OrientDB removal, Java 25 compatibility) and future flexibility (PostgreSQL support). The 6-8 week timeline is reasonable given the scope, and the resulting architecture will be significantly more maintainable and aligned with modern Spring best practices.
