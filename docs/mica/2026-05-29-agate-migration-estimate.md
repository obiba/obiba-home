# Migration Estimate: Agate → Direct OIDC + Email Service

**Date:** 2026-05-29  
**Author:** Migration Planning Analysis  
**Status:** Estimate  

---

## Executive Summary

**Total Estimated Effort: 3-4 weeks for 1 FTE**

**Risk Level: Low-Medium** (Much lower risk with rollover period and no user management)

This document outlines the effort required to migrate Mica2 from Agate (OBiBa's user management service) to:
1. Direct OIDC provider integration (e.g., Keycloak)
2. Self-hosted email service (copying from Agate's implementation)

---

## Key Simplifications

✅ **NO user management migration** - Handled by OIDC provider (Keycloak)  
✅ **obiba-oidc library already available** - Just needs configuration  
✅ **Email service uses same tech stack** - Can copy from Agate (Spring Boot, JavaMail, FreeMarker)  
✅ **Rollover period** - Both Agate and OIDC supported simultaneously (reduces risk)  
✅ **53 email templates already exist** - Just need to copy from Agate

---

## Current Agate Integration Overview

### Authentication
- **Agate URL**: Configured in `application.yml` (e.g., `http://localhost:8081`)
- **Authentication Method**: Application-level auth via `X-App-Auth` header (Basic Auth with service name:key)
- **OIDC Providers**: Fetched from Agate via `GET /ws/auth/providers`
- **User Profiles**: Retrieved from Agate via `GET /ws/tickets/subject/{username}`
- **Security Framework**: Apache Shiro with `ObibaRealm` for Agate ticket validation

### Email Service
- **Delegation**: All emails sent via `POST /ws/notifications` to Agate
- **Templates**: 53 FreeMarker templates hosted in Agate
- **Functionality**: Contact forms, data access notifications, password resets, etc.

### Key Files Currently Using Agate
| File | Purpose | Location |
|------|---------|----------|
| `AgateServerConfigService.java` | Agate connection configuration | `mica-core/.../service/` |
| `UserAuthService.java` | OIDC provider retrieval | `mica-core/.../service/` |
| `UserProfileService.java` | User profile management | `mica-user/` |
| `MailService.java` | Email delegation | `mica-core/.../service/` |
| `SecurityManagerFactory.java` | Shiro realm setup | `mica-core/.../security/` |
| `SessionsResource.java` | Login endpoint | `mica-rest/.../security/` |
| `SignController.java` | Sign-in/sign-up pages | `mica-webapp/.../controller/` |

---

## Component Breakdown

### 1. Direct OIDC Provider Configuration in Mica - 1.5-2 weeks

Mica already has the `obiba-oidc` (v5.1.2) and `obiba-shiro` libraries. The task is to **configure OIDC providers directly** instead of delegating to Agate.

#### Backend Changes (1-1.5 weeks)

**Phase 1: OIDC Configuration Model (2-3 days)**

Create configuration for OIDC providers in Mica.

**New Files:**
- `mica-core/.../domain/OidcProvider.java` - Domain model for OIDC provider config
- `mica-core/.../repository/OidcProviderRepository.java` - MongoDB repository
- `mica-core/.../service/OidcProviderService.java` - CRUD service for providers

**Configuration Example (application.yml):**
```yaml
oidc:
  providers:
    - name: keycloak
      title: Keycloak SSO
      clientId: mica-client
      clientSecret: ${OIDC_CLIENT_SECRET}
      discoveryUri: https://keycloak.example.com/realms/master/.well-known/openid-configuration
      scopes: openid,profile,email
      callbackUrl: https://mica.example.com/auth/callback/keycloak
      usernameClaimName: preferred_username
      groupsClaimName: groups
```

**Key Tasks:**
- Create MongoDB entity for OIDC provider configuration
- Add CRUD operations (create, read, update, delete providers)
- Add configuration UI in admin panel (or YAML-based config)
- Support for multiple providers (Keycloak, Azure AD, Google, etc.)

**Phase 2: OIDC Authentication Flow (3-4 days)**

Implement direct OIDC authentication using `obiba-oidc`.

**New Files:**
- `mica-core/.../security/OidcAuthenticationService.java` - Manages OIDC login/callback
- `mica-rest/.../security/OidcAuthController.java` - REST endpoints for OIDC flow
- `mica-webapp/.../web/filter/OidcLoginFilter.java` - Login filter (using obiba-oidc)
- `mica-webapp/.../web/filter/OidcCallbackFilter.java` - Callback filter

**Modified Files:**
- `SecurityManagerFactory.java` - Add `OIDCRealm` from obiba-oidc alongside `ObibaRealm`
- `UserAuthService.java` - Add method to return Mica-configured providers
- `SignController.java` - Support both Agate and direct OIDC URLs

**Key Tasks:**
- Configure `OIDCRealm` from obiba-oidc with provider configs
- Implement OIDC authorization code flow with PKCE
- Handle callback and token exchange
- Extract user profile from ID token / UserInfo endpoint
- Map OIDC groups to Mica roles using existing `MicaGroupsToRolesMapper`
- Create Shiro session with extracted user info

**Phase 3: Dual Authentication Support - Rollover Period (2-3 days)**

Support **both Agate and direct OIDC** during transition.

**Modified Files:**
- `UserAuthService.java` - Return combined list of providers (Agate + Mica)
- `SignController.java` - Generate signin URLs for both types
- `SecurityManagerFactory.java` - Configure both `ObibaRealm` and `OIDCRealm`
- `SessionsResource.java` - Handle both authentication methods

**Rollover Strategy Example:**
```java
public List<OIDCAuthProviderSummary> getOidcProviders(String locale) {
    List<OIDCAuthProviderSummary> providers = new ArrayList<>();
    
    // Add Agate providers if configured
    if (agateConfigService.isAgateConfigured()) {
        providers.addAll(getAgateOidcProviders(locale));
    }
    
    // Add Mica-native OIDC providers
    providers.addAll(getMicaOidcProviders(locale));
    
    return providers;
}
```

**Key Tasks:**
- Check if Agate is configured, fall back to Mica OIDC if not
- Allow both authentication paths to coexist
- Unified session management (both create Shiro sessions)
- Configuration flag to disable Agate authentication (for final cutover)

#### Frontend Changes (0.5 week = 2-3 days)

**Modified Files:**
- `mica-ui/src/stores/auth.ts` - Support direct OIDC callback handling
- `mica-ui/src/components/signin/*.vue` - Update to handle both provider types
- Login/signup pages

**Key Tasks:**
- Handle OIDC callback redirect (parse authorization code from URL)
- Call Mica backend to complete OIDC flow
- Maintain backward compatibility with Agate flow
- Update UI to display provider type (Agate vs direct)

---

### 2. Email Service Implementation - 1-1.5 weeks

Copy Agate's email implementation (same tech stack: Spring Boot + JavaMail + FreeMarker).

#### Agate Email Service Overview

**Agate Implementation:**
- **MailService.java** (83 lines) - Simple wrapper around Spring's `JavaMailSenderImpl`
- **MailConfiguration.java** - Configures JavaMailSender with SMTP or OAuth2
- **OAuth2TokenService.java** - Manages OAuth2 token lifecycle for cloud email providers
- **Templates** - 53 FreeMarker templates for Mica notifications

**Source Files to Copy:**
```
../agate/agate-core/src/main/java/org/obiba/agate/service/MailService.java
../agate/agate-core/src/main/java/org/obiba/agate/config/MailConfiguration.java
../agate/agate-core/src/main/java/org/obiba/agate/service/OAuth2TokenService.java
../agate/agate-webapp/src/main/resources/_templates/notifications/mica/*.ftl
```

#### Phase 1: Email Infrastructure (2-3 days)

**New Files:**
- `mica-core/.../config/MailConfiguration.java` - Copy from Agate
- `mica-core/.../service/OAuth2TokenService.java` - Copy from Agate (if OAuth2 needed)

**Modified Files:**
- `mica-core/.../service/MailService.java` - Replace delegation with direct implementation
- `pom.xml` - Add `spring-boot-starter-freemarker` dependency (if not present)

**Configuration (application.yml):**
```yaml
spring:
  mail:
    auth-type: smtp  # or oauth2
    host: smtp.example.com
    port: 587
    username: mica@example.com
    password: ${SMTP_PASSWORD}
    protocol: smtp
    tls: true
    auth: true
    from: mica@example.org
    # OAuth2 config (if needed for Microsoft 365, Gmail, etc.)
    oauth2:
      user: mica@example.com
      client-id: ${OAUTH_CLIENT_ID}
      client-secret: ${OAUTH_CLIENT_SECRET}
      tenant-id: ${OAUTH_TENANT_ID}
      refresh-token: ${OAUTH_REFRESH_TOKEN}
      token-uri: https://login.microsoftonline.com/${OAUTH_TENANT_ID}/oauth2/v2.0/token
      scope: https://outlook.office365.com/SMTP.Send
```

**Dependencies to Add:**
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-mail</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-freemarker</artifactId>
</dependency>
```

**Key Tasks:**
- Configure `JavaMailSenderImpl` bean
- Support both SMTP and OAuth2 authentication (copy from Agate)
- Implement async email sending with `@Async`
- Add error handling and logging

#### Phase 2: Template Migration (1-2 days)

**Copy Templates:**
```bash
cp -r ../agate/agate-webapp/src/main/resources/_templates/notifications/mica/* \
      ../mica2/mica-webapp/src/main/resources/_templates/notifications/
```

**53 Templates to Copy (examples):**
- `dataAccessRequestSubmittedApplicantEmail.ftl`
- `dataAccessRequestApprovedApplicantEmail.ftl`
- `dataAccessRequestRejectedApplicantEmail.ftl`
- `commentAdded.ftl`
- `contactUs.ftl`
- ... (48 more templates)

**Key Tasks:**
- Copy all 53 FreeMarker templates from Agate
- Update template paths in Mica configuration
- Verify template variables match Mica's context
- Test internationalization (i18n) support

#### Phase 3: Service Rewrite (2 days)

**Modified File:**
- `mica-core/.../service/MailService.java` - Rewrite to use local mail sender

**Before (delegating to Agate):**
```java
private void sendEmail(String subject, String templateName, 
                      Map<String, String> context, String recipient) {
    RestTemplate template = newRestTemplate();
    // POST to Agate /ws/notifications
    // ...
}
```

**After (direct implementation):**
```java
@Async
public void sendEmail(String to, String subject, String templateName, 
                     Map<String, Object> context) {
    try {
        // Process FreeMarker template
        String htmlContent = processTemplate(templateName, context);
        
        // Send via JavaMailSender
        MimeMessage message = javaMailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setTo(to);
        helper.setFrom(mailFrom);
        helper.setSubject(subject);
        helper.setText(htmlContent, true); // HTML
        
        javaMailSender.send(message);
        log.info("Email sent successfully to {}", to);
    } catch (Exception e) {
        log.error("Failed to send email to {}", to, e);
    }
}

private String processTemplate(String templateName, Map<String, Object> context) 
    throws Exception {
    Template template = freemarkerConfig.getTemplate(templateName + ".ftl");
    return FreeMarkerTemplateUtils.processTemplateIntoString(template, context);
}
```

**Key Tasks:**
- Remove REST calls to Agate
- Implement FreeMarker template processing
- Add context variable support (user, organization, publicUrl, etc.)
- Maintain async behavior
- Add error handling and retry logic
- Support for both username-based and email-based recipients

#### Phase 4: Rollover Period Dual Support (1 day)

Support **both Agate delegation and local email** during transition.

**Modified File:**
- `mica-core/.../service/MailService.java`

**Strategy:**
```java
@Async
public void sendEmail(String subject, String templateName, 
                     Map<String, Object> context, String recipient) {
    if (useLocalEmailService()) {
        sendEmailLocal(subject, templateName, context, recipient);
    } else {
        sendEmailViaAgate(subject, templateName, context, recipient);
    }
}

private boolean useLocalEmailService() {
    return micaConfigService.isLocalEmailEnabled() 
        || !agateConfigService.isAgateConfigured();
}
```

**Configuration:**
```yaml
mica:
  email:
    use-local: true  # Switch to toggle local email service
```

**Key Tasks:**
- Add configuration flag to switch between Agate and local
- Keep Agate delegation code intact during rollover
- Allow testing local email without breaking production
- Gradual migration with monitoring

---

### 3. Testing & Validation - 0.5-1 week (2-4 days)

#### Integration Testing (1-2 days)
- Test OIDC login flow with Keycloak/provider
- Test email delivery for all 53 templates
- Test role mapping from OIDC groups to Mica roles
- Test session management and logout
- Test both Agate and direct OIDC during rollover
- Test both Agate and local email during rollover

#### Regression Testing (1 day)
- Verify all existing features work with new auth
- Test data access requests (triggers emails)
- Test contact forms
- Test user profiles
- Test all user roles (administrator, reviewer, editor, dao, user)

#### Security Testing (1 day)
- OIDC security audit (PKCE, state/nonce validation)
- Email injection testing
- Session management testing
- Test logout and token cleanup
- Verify JWT token validation
- Test group/role mapping security

---

## Detailed Time Breakdown

| **Component** | **Estimated Time** | **Complexity** |
|---------------|-------------------|---------------|
| **1. Direct OIDC Configuration** | **1.5-2 weeks** | Medium |
| - OIDC config model | 2-3 days | Low |
| - OIDC authentication flow | 3-4 days | Medium |
| - Dual auth support (rollover) | 2-3 days | Medium |
| - Frontend changes | 2-3 days | Low |
| **2. Email Service Implementation** | **1-1.5 weeks** | Low-Medium |
| - Email infrastructure | 2-3 days | Low |
| - Template migration | 1-2 days | Low |
| - Service rewrite | 2 days | Medium |
| - Dual email support (rollover) | 1 day | Low |
| **3. Testing & Validation** | **0.5-1 week** | Medium |
| - Integration testing | 1-2 days | Medium |
| - Regression testing | 1 day | Low |
| - Security testing | 1 day | Medium |
| **Total** | **3.5-4.5 weeks** | |
| **Contingency (10%)** | **0.5 week** | |
| **Grand Total** | **4-5 weeks** | |

**Realistic Estimate: 3-4 weeks for 1 senior FTE**

---

## Rollover Period Strategy

### Phase 1: Development & Parallel Testing (Weeks 1-3)
- Implement OIDC and email services
- Test alongside Agate (both enabled)
- Configuration allows switching between modes
- No impact on production users

**Configuration During Rollover:**
```yaml
# Keep Agate configured for fallback
agate:
  url: http://localhost:8081
  application:
    name: mica
    key: changeit

# Add new OIDC providers
oidc:
  providers:
    - name: keycloak
      # ... configuration

# Enable local email with fallback
mica:
  email:
    use-local: false  # Start with false, switch to true when ready
```

### Phase 2: Soft Launch (Week 4)
- Enable direct OIDC for new users only
- Keep Agate for existing users
- Enable local email for non-critical notifications
- Monitor email delivery rates
- Collect feedback

### Phase 3: Full Migration (Week 4-5)
- Migrate all users to direct OIDC
- Disable Agate authentication
- Switch all emails to local service
- Monitor for issues
- Keep Agate running but unused

### Phase 4: Cleanup (Week 5+)
- Remove Agate dependencies from configuration
- Remove dual-support code
- Update documentation
- Decommission Agate (if no other apps use it)

**Rollover Duration:** 1-2 weeks of parallel operation recommended

---

## Risk Factors & Mitigation

### Low-Risk Areas

1. **Email Service** ✅
   - **Risk:** Very low - same tech stack as Agate
   - **Mitigation:** Copy working code directly, test templates thoroughly

2. **OIDC Library** ✅
   - **Risk:** Low - obiba-oidc already available and tested in Agate
   - **Mitigation:** Follow existing patterns from Agate/obiba-commons

3. **Rollover Period** ✅
   - **Risk:** Very low - both systems run in parallel
   - **Mitigation:** Gradual migration, easy rollback, no user disruption

### Medium-Risk Areas

1. **OIDC Configuration**
   - **Risk:** Incorrect provider configuration could break login
   - **Mitigation:** Extensive testing, keep Agate as fallback initially, test with test users first

2. **Group/Role Mapping**
   - **Risk:** Users might lose permissions if mapping is wrong
   - **Mitigation:** Test with various user types, manual verification, audit logs

3. **Email Deliverability**
   - **Risk:** Emails marked as spam, delivery failures
   - **Mitigation:** Proper DNS configuration (SPF, DKIM, DMARC), warm-up period, monitoring

---

## Assumptions

- Senior full-stack Java engineer familiar with:
  - Spring Boot, Spring Security, Apache Shiro
  - OIDC/OAuth 2.0 protocols
  - FreeMarker templates
  - MongoDB (for OIDC provider config)
  - Vue.js/TypeScript (for frontend changes)
- OIDC provider (Keycloak) is already configured with clients
- Email infrastructure (SMTP or OAuth2) is available and tested
- Existing test coverage is adequate (unit tests, integration tests)
- Access to Agate source code for reference

---

## Alternative Approaches

### Option 1: Configuration-Only (No Database)
**Effort:** 2.5-3 weeks
- Use YAML configuration for OIDC providers (no MongoDB storage)
- No admin UI for provider management
- **Pros:** Faster development, simpler architecture
- **Cons:** Less flexible, requires app restart to add/modify providers

### Option 2: Extend Rollover Period
**Effort:** Same (3-4 weeks dev) + longer testing
- Run both systems for 1-2 months instead of 1-2 weeks
- **Pros:** Lower risk, more time to find issues, gradual user migration
- **Cons:** Maintenance overhead, delayed Agate decommission

### Option 3: OIDC Only, Keep Agate for Email
**Effort:** 2-2.5 weeks
- Migrate authentication to direct OIDC
- Keep email delegation to Agate
- **Pros:** Faster, reduced scope
- **Cons:** Still dependent on Agate, doesn't fully address migration goal

---

## Files to Create/Modify

### New Files (~10 core files + 53 templates):
1. `mica-core/.../domain/OidcProvider.java`
2. `mica-core/.../repository/OidcProviderRepository.java`
3. `mica-core/.../service/OidcProviderService.java`
4. `mica-core/.../security/OidcAuthenticationService.java`
5. `mica-rest/.../security/OidcAuthController.java`
6. `mica-webapp/.../web/filter/OidcLoginFilter.java`
7. `mica-webapp/.../web/filter/OidcCallbackFilter.java`
8. `mica-core/.../config/MailConfiguration.java` (copy from Agate)
9. `mica-core/.../service/OAuth2TokenService.java` (copy from Agate, if needed)
10. 53 FreeMarker templates (copy from Agate)

### Modified Files (~10 files):
1. `mica-core/.../service/UserAuthService.java` - Add Mica provider support
2. `mica-core/.../service/MailService.java` - Replace delegation with direct impl
3. `mica-core/.../security/SecurityManagerFactory.java` - Add OIDCRealm
4. `mica-webapp/.../SignController.java` - Support both provider types
5. `mica-rest/.../SessionsResource.java` - Handle OIDC callback
6. `mica-rest/.../CurrentSessionResource.java` - Update session handling
7. `mica-ui/src/stores/auth.ts` - OIDC callback handling
8. `mica-ui/src/components/signin/*.vue` - Update UI for OIDC
9. `application.yml` / `application-dev.yml` / `application-prod.yml` - Add OIDC and email config
10. `pom.xml` - Add spring-boot-starter-freemarker (if not present)

---

## Recommended Timeline (4 weeks)

### Week 1: OIDC Configuration & Flow
- **Days 1-3:** Create OIDC provider configuration model (MongoDB, service, repository)
- **Days 4-5:** Implement OIDC authentication flow (obiba-oidc integration, OIDCRealm setup)

### Week 2: Dual Auth Support & Frontend
- **Days 1-3:** Implement rollover period dual authentication (Agate + OIDC)
- **Days 4-5:** Update frontend for OIDC callback handling and UI changes

### Week 3: Email Service Implementation
- **Days 1-2:** Set up email infrastructure (copy MailConfiguration, OAuth2TokenService from Agate)
- **Day 3:** Copy and adapt 53 FreeMarker templates
- **Days 4-5:** Rewrite MailService with dual support (Agate delegation + local implementation)

### Week 4: Testing & Validation
- **Days 1-2:** Integration testing (OIDC login/logout, email delivery, role mapping)
- **Day 3:** Regression testing (all features, all roles, all email types)
- **Day 4:** Security testing (OIDC compliance, session security, email injection)
- **Day 5:** Documentation, deployment prep, rollover plan finalization

### Rollover Period (Weeks 4-6):
- **Week 4-5:** Soft launch with new users, parallel operation
- **Week 5-6:** Full migration of existing users, monitor stability
- **Week 6+:** Cleanup and Agate decommission

---

## Success Criteria

### Authentication Migration Success
- [ ] Users can log in via direct OIDC provider (Keycloak)
- [ ] Users can log in via Agate (during rollover period)
- [ ] OIDC groups are correctly mapped to Mica roles
- [ ] Sessions are created and maintained correctly
- [ ] Logout works for both authentication methods
- [ ] No security vulnerabilities in OIDC implementation

### Email Service Success
- [ ] All 53 email templates render correctly
- [ ] Emails are delivered successfully (>99% delivery rate)
- [ ] Emails are not marked as spam
- [ ] Templates support internationalization (multiple languages)
- [ ] Async email sending works without blocking requests
- [ ] Error handling and retry logic work correctly

### Rollover Period Success
- [ ] Both authentication methods work simultaneously
- [ ] Both email methods work simultaneously
- [ ] Configuration allows easy switching between modes
- [ ] No user disruption during migration
- [ ] Easy rollback to Agate if issues occur

### Final Cutover Success
- [ ] All users migrated to direct OIDC
- [ ] All emails sent via local service
- [ ] Agate configuration can be removed
- [ ] No references to Agate in critical code paths
- [ ] Documentation updated
- [ ] Agate decommissioned (if no other dependencies)

---

## Key Advantages of This Approach

✅ **Much lower risk** than full rewrite (obiba-oidc already exists)  
✅ **Same tech stack** for email (copy from Agate)  
✅ **No user migration** needed (OIDC provider handles users)  
✅ **Gradual rollover** allows easy rollback  
✅ **Shorter timeline** (4 weeks vs 12-17 weeks from original estimate)  
✅ **Leverages existing code** (Agate email templates and configuration)  
✅ **Minimal disruption** to users (parallel operation during rollover)

---

## Comparison with Original Estimate

| Aspect | Original Estimate | Revised Estimate |
|--------|------------------|------------------|
| **Duration** | 12-17 weeks | 3-4 weeks |
| **User Management** | Full migration required | Not needed (OIDC provider) |
| **OIDC Implementation** | Build from scratch | Use obiba-oidc library |
| **Email Service** | Build from scratch | Copy from Agate |
| **Risk Level** | Medium-High | Low-Medium |
| **Rollover Support** | Not planned | Built-in |
| **Complexity** | High | Low-Medium |

**Time Savings: 75% reduction in effort**

---

## Conclusion

**Minimum viable migration:** 3 weeks (1 FTE)  
**Production-ready with full testing:** 4 weeks (1 FTE)  
**Rollover period:** 1-2 weeks parallel operation  

**Total project duration:** 5-6 weeks from start to Agate decommission

### Recommendation

Allocate **4 weeks with 1 senior full-stack engineer**, followed by **1-2 weeks of parallel operation** before full cutover to direct OIDC and local email service.

This approach provides:
- Low risk due to gradual rollover
- High confidence due to reusing proven code (obiba-oidc, Agate email templates)
- Easy rollback if issues arise
- Minimal user disruption
- Clear success criteria and testing strategy

---

## Next Steps

1. **Review and approval** of this migration plan
2. **Resource allocation** (1 senior full-stack engineer for 4 weeks)
3. **Infrastructure preparation:**
   - Set up Keycloak instance with realms and clients
   - Configure SMTP or OAuth2 email credentials
   - Prepare DNS records for email (SPF, DKIM, DMARC)
4. **Development environment setup:**
   - Clone Agate source code for reference
   - Set up local Keycloak for testing
   - Configure test email service
5. **Kickoff meeting** to finalize requirements and timeline
6. **Begin Week 1 development** per timeline above

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-29
