# Work Estimate: H2 Database Support for JDBC Datasource

## Executive Summary

**Total Effort:** 2-4 developer days  
**Complexity:** Low to Medium  
**Risk:** Low  

The JDBC datasource is already well-architected with Liquibase providing database abstraction. H2 is already supported by Liquibase 4.26.0, so most functionality will work out-of-the-box. The work primarily involves testing, documentation, and potentially creating an H2-specific SQL visitor for edge cases.

---

## Current State Analysis

**✅ What Already Exists:**
- Liquibase 4.26.0 has built-in H2 support
- HSQLDB (similar in-memory database) is already used for testing
- Database-agnostic architecture via Liquibase
- SQL visitor pattern for database-specific tweaks
- Comprehensive test suite with Spring configuration

**❌ What's Missing:**
- H2 JDBC driver dependency
- H2-specific SQL visitor (if needed)
- H2 integration tests
- Documentation for H2 configuration

---

## Detailed Work Breakdown

### 1. Add H2 JDBC Driver Dependency (0.5 days)

**Files to modify:**
- `/home/yannick/projects/magma/pom.xml` - Add version property
- `/home/yannick/projects/magma/magma-datasource-jdbc/pom.xml` - Add dependency

**Tasks:**
- Add H2 driver to parent POM dependency management (test scope)
- Add H2 dependency to JDBC datasource module
- Choose appropriate H2 version (latest 2.x recommended)

**Estimated lines of code:** ~10 lines

**Example:**
```xml
<!-- In parent pom.xml -->
<h2.version>2.2.224</h2.version>

<!-- In magma-datasource-jdbc/pom.xml -->
<dependency>
  <groupId>com.h2database</groupId>
  <artifactId>h2</artifactId>
  <scope>test</scope>
</dependency>
```

---

### 2. Investigate H2-Specific SQL Quirks (0.5 days)

**Goal:** Determine if an H2EngineVisitor is needed

**Investigation areas:**
1. **Data types:** Compare H2's type support with Magma's needs
   - BLOB/CLOB handling
   - Binary data (BINARY vs BLOB)
   - Date/Time types
   
2. **SQL syntax differences:**
   - AUTO_INCREMENT vs IDENTITY
   - Index creation syntax
   - Transaction behavior

3. **Liquibase compatibility:**
   - Test Liquibase's H2Database implementation
   - Check if type mappings are correct

**Deliverable:** Decision document on whether H2EngineVisitor is needed

**Likely outcome:** H2 is very standards-compliant; visitor probably unnecessary

---

### 3. Create H2EngineVisitor (if needed) (0.5 days)

**Only if investigation reveals H2-specific issues**

**File to create:**
- `/home/yannick/projects/magma/magma-datasource-jdbc/src/main/java/org/obiba/magma/datasource/jdbc/support/H2EngineVisitor.java`

**Pattern to follow:**
```java
public class H2EngineVisitor extends AbstractSqlVisitor {
  
  public H2EngineVisitor() {
    setApplicableDbms(ImmutableSet.of("h2"));
  }

  @Override
  public String modifySql(String sql, Database database) {
    // Apply H2-specific SQL modifications
    return sql;
  }

  @Override
  public String getName() {
    return H2EngineVisitor.class.getSimpleName();
  }
}
```

**File to modify:**
- `/home/yannick/projects/magma/magma-datasource-jdbc/src/main/java/org/obiba/magma/datasource/jdbc/JdbcDatasource.java:665`

```java
ChangeDatabaseCallback(Iterable<Change> changes) {
  this(changes, Lists.newArrayList(
    new MySqlEngineVisitor(), 
    new PostgreSqlEngineVisitor(),
    new H2EngineVisitor()  // Add this
  ));
}
```

**Estimated lines of code:** ~40-50 lines

---

### 4. Create H2 Test Configuration (0.5 days)

**File to create:**
- `/home/yannick/projects/magma/magma-datasource-jdbc/src/test/resources/test-spring-context-h2.xml`

**Pattern to follow (based on existing HSQLDB config):**
```xml
<bean id="h2DataSource" class="org.apache.commons.dbcp2.BasicDataSource">
  <property name="driverClassName" value="org.h2.Driver"/>
  <property name="url" value="jdbc:h2:mem:JdbcDatasourceTest;MODE=MySQL;DB_CLOSE_DELAY=-1"/>
  <property name="username" value="sa"/>
  <property name="password" value=""/>
  <property name="defaultAutoCommit" value="true"/>
  <property name="maxTotal" value="-1"/>
</bean>
```

**Key H2 URL parameters to consider:**
- `MODE=MySQL` or `MODE=PostgreSQL` - Compatibility mode
- `DB_CLOSE_DELAY=-1` - Keep in-memory DB alive between connections
- `INIT=RUNSCRIPT FROM 'classpath:schema.sql'` - Optional initialization

**Estimated lines of code:** ~20-30 lines

---

### 5. Create H2-Specific Integration Tests (1-2 days)

**Approach:** Duplicate key test cases from JdbcDatasourceTest with H2 configuration

**File to create:**
- `/home/yannick/projects/magma/magma-datasource-jdbc/src/test/java/org/obiba/magma/datasource/jdbc/JdbcDatasourceH2Test.java`

**Test scenarios to cover:**

| Test Case | Purpose | Estimated Effort |
|-----------|---------|------------------|
| testCreateDatasourceFromExistingDatabase | Basic datasource creation | 0.25 days |
| testCreateDatasourceWithMetadataTables | Metadata table support | 0.25 days |
| testWriteAndReadValues | CRUD operations | 0.25 days |
| testBinaryDataHandling | BLOB/binary support | 0.25 days |
| testTransactionSupport | Transaction handling | 0.25 days |
| testBatchOperations | Batch insert/update | 0.25 days |
| testDateTimeTypes | Date/Time handling | 0.25 days |
| testMultilinesSupport | Repeatable variables | 0.25 days |

**Pattern:**
```java
@RunWith(SpringJUnit4ClassRunner.class)
@ContextConfiguration("/test-spring-context-h2.xml")
@Transactional
public class JdbcDatasourceH2Test extends AbstractMagmaTest {
  
  @Autowired
  private DataSource h2DataSource;
  
  @Test
  public void testH2BasicOperations() {
    // Test H2-specific behavior
  }
}
```

**Estimated lines of code:** ~300-500 lines (many copy-paste from existing tests)

---

### 6. Documentation (0.5 days)

**Files to update:**
1. **Main README or datasource documentation**
   - Add H2 to supported databases list
   - Provide example H2 configuration
   
2. **Maven dependency documentation**
   - Show how to add H2 driver to projects

**Example documentation:**

```markdown
### Supported Databases

- MySQL 8.x
- MariaDB 10.x
- PostgreSQL 12+
- Microsoft SQL Server 2019+
- H2 2.x (in-memory and file-based)
- HSQLDB 2.x

### H2 Configuration Example

```java
// In-memory H2 database
BasicDataSource dataSource = new BasicDataSource();
dataSource.setDriverClassName("org.h2.Driver");
dataSource.setUrl("jdbc:h2:mem:mydb;MODE=MySQL");
dataSource.setUsername("sa");
dataSource.setPassword("");

// File-based H2 database
dataSource.setUrl("jdbc:h2:file:/path/to/database;MODE=MySQL");

// Create datasource
JdbcDatasource jdbcDatasource = new JdbcDatasource(
  "my-datasource", 
  dataSource,
  JdbcDatasourceSettings.newSettings("Participant").build()
);
```
```

**Estimated lines of code:** ~50-100 lines of documentation

---

## Risk Assessment & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| H2 type incompatibilities | Low | Medium | Comprehensive testing, H2EngineVisitor if needed |
| Liquibase H2 bugs | Very Low | Medium | Use latest Liquibase version, report upstream |
| Test environment issues | Low | Low | Follow HSQLDB test pattern closely |
| Performance differences | Low | Low | Document H2 performance characteristics |

---

## Testing Strategy

**1. Unit Tests:**
- H2EngineVisitor (if created) - verify SQL modifications

**2. Integration Tests:**
- Full datasource lifecycle (initialize, CRUD, dispose)
- All data types (Binary, Boolean, Decimal, Date, DateTime, Integer, Text, Point, etc.)
- Metadata tables functionality
- Transaction support
- Batch operations
- View support

**3. Manual Testing:**
- In-memory H2 (fastest, for CI)
- File-based H2 (persistence testing)
- H2 compatibility modes (MySQL, PostgreSQL)

**4. Regression Testing:**
- Ensure existing database support not affected
- Run full test suite with all databases

---

## Dependencies & Prerequisites

**Build Tool:**
- Maven 3.x

**Java Version:**
- Java 11+ (based on project dependencies)

**External Dependencies:**
- H2 Database 2.2.x (latest stable)
- No changes to Liquibase required

---

## Implementation Phases

### Phase 1: Investigation & Setup (1 day)
1. Add H2 dependency
2. Investigate H2 SQL quirks
3. Create test configuration

### Phase 2: Implementation (1 day)
1. Create H2EngineVisitor (if needed)
2. Integrate into ChangeDatabaseCallback
3. Write basic integration tests

### Phase 3: Testing & Documentation (1-2 days)
1. Comprehensive integration tests
2. Manual testing with different H2 modes
3. Update documentation
4. Code review

---

## Alternative Approaches

### Option 1: Minimal Approach (1-2 days)
- Add H2 dependency only
- Basic smoke tests
- Minimal documentation
- **Pros:** Fast, low risk
- **Cons:** Limited validation, potential production issues

### Option 2: Comprehensive Approach (3-4 days)
- Full test coverage matching other databases
- H2EngineVisitor with extensive SQL rewriting
- Performance benchmarks
- Migration guides
- **Pros:** Production-ready, well-documented
- **Cons:** Higher effort

### Recommended: Balanced Approach (2-3 days)
- H2 dependency and visitor (if needed)
- Core integration tests covering key scenarios
- Basic documentation
- **Pros:** Good balance of effort and validation
- **Cons:** None significant

---

## Success Criteria

✅ H2 driver dependency added  
✅ All existing tests pass with H2  
✅ New H2-specific tests pass  
✅ Documentation updated  
✅ Code review completed  
✅ No regression in other database support  

---

## Open Questions

1. **H2 version selection:** Use latest 2.x or maintain backward compatibility?
2. **Compatibility mode:** Default to MySQL mode, PostgreSQL mode, or standard H2?
3. **Test scope:** In-memory only or include file-based tests?
4. **Production support:** Is H2 intended for production use or testing only?

---

## Conclusion

Adding H2 support is straightforward due to:
1. Existing Liquibase abstraction layer
2. H2's SQL standards compliance
3. Similar HSQLDB already used for testing
4. Well-established visitor pattern for customization

**Recommended effort allocation:**
- Investigation: 0.5 days
- Implementation: 1 day
- Testing: 1 day
- Documentation: 0.5 days
- **Total: 3 days** (with buffer for unexpected issues)

The work is low-risk and provides valuable flexibility for development/testing scenarios with H2's excellent in-memory performance.

---

## Appendix: Current JDBC Datasource Architecture

### Core Files
- `JdbcDatasource.java` (706 lines) - Main datasource implementation
- `JdbcDatasourceFactory.java` (45 lines) - Factory pattern
- `JdbcDatasourceSettings.java` (267 lines) - Configuration
- `JdbcValueTable.java` (667 lines) - Table abstraction
- `JdbcValueTableWriter.java` (690 lines) - Write operations
- `SqlTypes.java` (131 lines) - Type mapping

### Database-Specific Visitors
- `MySqlEngineVisitor.java` (40 lines) - MySQL customization
- `PostgreSqlEngineVisitor.java` (36 lines) - PostgreSQL customization

### Currently Supported Databases
1. MySQL 8.4.0 (with InnoDB enforcement, BLOB→LONGBLOB conversion)
2. MariaDB 3.0.7
3. PostgreSQL 42.7.2 (with OID→BYTEA conversion)
4. Microsoft SQL Server 12.10.2
5. HSQLDB 2.7.1 (testing only)

### Technology Stack
- Liquibase 4.26.0 - Database abstraction
- Apache Commons DBCP2 2.9.0 - Connection pooling
- Spring JDBC - Data access
- Spring Transactions - Transaction management
