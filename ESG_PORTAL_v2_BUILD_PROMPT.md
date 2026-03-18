# 📊 ESG PORTAL - COMPREHENSIVE CODEBASE REVIEW

## 🎯 PRODUCT UNDERSTANDING

### What It Does
ESG Portal is a **compliance automation SaaS** that transforms complex Environmental, Social, and Governance (ESG) reporting requirements into manageable workflows for SMEs. The app:
- Automatically assigns ESG frameworks based on company profile (location, sector)
- Generates personalized compliance checklists via intelligent profiling wizard
- Collects monthly environmental data (electricity, water, waste, fuel, etc.)
- Tracks compliance progress with visual dashboards
- Manages evidence documentation for audits

### Target Market
- **Primary**: UAE Hospitality Sector (hotels, resorts) - ~4000+ properties
- **Secondary**: Other SME sectors (real estate, finance, manufacturing, healthcare)
- **Regulatory Bodies**: Dubai Sustainable Tourism (DST), Green Key, UAE ESG standards

### Business Value
- Reduces compliance reporting time by 70%
- Eliminates manual spreadsheet tracking
- Provides audit-ready evidence documentation
- Real-time progress monitoring for management
- Automated framework requirement matching

---

## 🏗️ ARCHITECTURE MAPPING

### Frontend Architecture
```
React 18 SPA
├── React Router v6 (Client-side routing)
├── Tailwind CSS (Styling)
├── Context API (Auth state)
├── Fetch API (Backend communication)
└── 30+ Feature Components
```

**Key Flows:**
1. **Auth Flow**: Login → Email Verification → Dashboard
2. **Onboarding**: Company Setup → Framework Assignment → Profiling Wizard
3. **Data Collection**: Month Selection → Data Entry → Evidence Upload → Progress Update
4. **Dashboard**: Real-time metrics → Progress visualization → Task management

### Backend Architecture
```
Django 4.2.7 REST API
├── DRF ViewSets (RESTful endpoints)
├── Service Layer (Business logic separation)
├── Session Authentication (CSRF-exempt for SPA)
├── WhiteNoise (Static file serving)
└── PostgreSQL/SQLite (Database)
```

**Service Layer:**
- `FrameworkService` - Auto-assign frameworks based on company profile
- `ProfilingService` - Generate personalized checklists from questionnaires
- `ChecklistService` - Manage data element requirements
- `MeterService` - Handle measurement device CRUD
- `DataCollectionService` - Validate and store data submissions
- `DashboardService` - Calculate progress metrics

### Database Schema
```python
User → UserProfile (role, email, company)
  ↓
Company (emirate, sector, active_frameworks JSON)
  ↓
CompanyFramework ← Framework (ESG, DST, Green Key)
  ↓
CompanyChecklist ← DataElement (80+ ESG elements)
  ↓
Meter (measurement devices)
  ↓
CompanyDataSubmission (monthly data + evidence files)
```

### API Endpoints
```
/auth/                    # Login, signup, password reset
/companies/               # Company CRUD
/frameworks/              # Framework management
/data-elements/           # ESG data elements
/profiling-questions/     # Dynamic questionnaire
/meters/                  # Measurement devices
/data-submissions/        # Data collection
/dashboard/               # Progress metrics
```

---

## 🔧 TECH STACK

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Django | 4.2.7 | Web framework |
| DRF | 3.14.0 | REST API |
| PostgreSQL | - | Production database |
| SQLite | - | Development database |
| Gunicorn | 21.2.0 | Production server |
| WhiteNoise | 6.9.0 | Static file serving |
| SendGrid | 6.11.0 | Email service |
| Pillow | 10.4.0 | Image handling |

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2.0 | UI framework |
| React Router | 6.3.0 | Client routing |
| Tailwind CSS | 3.1.0 | Styling |
| Create React App | 5.0.1 | Build tool |

### Deployment
- **Platform**: Render.com (backend), Vercel (frontend option)
- **Database**: PostgreSQL (Render-managed)
- **Static Files**: WhiteNoise + Django collectstatic
- **Environment**: Docker support available

---

## 🚨 WEAKNESSES & ISSUES

### Critical Issues (Must Fix)

1. **Debug Code in Production** 🔴
   - **Problem**: 130+ instances of `print()` statements with emojis (🔍, 📧) scattered across codebase
   - **Impact**: Performance degradation, security exposure, unprofessional output
   - **Files Affected**: `settings.py`, `email_service.py`, `signals.py`, `services.py`

2. **Security Vulnerabilities** 🔴
   - Hardcoded API keys in some files
   - Missing rate limiting on authentication endpoints
   - No input sanitization on file uploads
   - Excessive debugging info in error responses

3. **Performance Bottlenecks** 🟡
   - No database indexing on frequently queried fields
   - Large JSON fields (`active_frameworks`) impact query speed
   - No pagination on list endpoints (will break with 1000+ records)
   - N+1 query problems in dashboard calculations

4. **Scalability Issues** 🟡
   - File storage in Django `media/` (won't scale beyond 10GB)
   - Session-based auth (not suitable for distributed systems)
   - No caching layer (Redis/Memcached)
   - No background job queue (Celery/RQ)

### Code Quality Issues

1. **Technical Debt** 🟡
   - Multiple duplicate components (`Dashboard.js`, `DashboardNew.js`, `DashboardTest.js`)
   - Large files (Data.js: 1000+ lines, services.py: 900+ lines)
   - 130+ TODO/FIXME comments
   - Inconsistent error handling patterns

2. **Outdated Practices** 🟢
   - Using Create React App (deprecated in favor of Vite)
   - No TypeScript (type safety issues)
   - Class components mixed with hooks
   - Bootstrap + Tailwind (inconsistent styling)

3. **Missing Features** 🟢
   - No data export functionality (CSV/PDF)
   - No audit trail for compliance
   - No automated reminders for deadlines
   - No multi-language support (UAE has Arabic-speaking users)
   - No mobile app

---

## ✅ STRENGTHS (Keep in New Version)

### Excellent Architecture Patterns

1. **Service Layer Pattern** ⭐⭐⭐⭐⭐
   - Business logic cleanly separated from views
   - Easy to test and maintain
   - `FrameworkService.assign_mandatory_frameworks()` is brilliant
   - `ProfilingService.generate_checklist()` handles complex logic well

2. **Smart Framework Assignment** ⭐⭐⭐⭐⭐
   - Automatic assignment based on emirate + sector
   - JSON field for flexible framework tracking
   - De-duplication logic prevents duplicate requirements
   - Frequency consolidation (Monthly > Quarterly > Annually)

3. **Personalized Compliance Checklists** ⭐⭐⭐⭐⭐
   - Dynamic questionnaire system
   - Generates tailored requirements per company
   - Reduces complexity for users
   - Auto-creates meters for metered elements

4. **Role-Based Access Control** ⭐⭐⭐⭐
   - 6 well-defined roles (super_user, admin, site_manager, uploader, viewer, meter_manager)
   - Company-scoped permissions
   - Clean UserProfile model

5. **Evidence Management** ⭐⭐⭐⭐
   - File upload system with organized directory structure
   - Auto-matching to data elements
   - Supports compliance audits

6. **Progress Tracking** ⭐⭐⭐⭐
   - Monthly and annual progress metrics
   - Visual dashboard with completion rates
   - Status indicators (Missing, Partial, Complete)

### Good Development Practices

1. **Environment Configuration** ⭐⭐⭐⭐
   - Proper `.env` file usage
   - Environment-aware settings
   - Separate development/production configs

2. **Database Design** ⭐⭐⭐⭐
   - Well-structured relationships
   - Proper Foreign Key usage
   - JSON fields for flexibility

3. **RESTful API Design** ⭐⭐⭐⭐
   - Consistent endpoint naming
   - Proper HTTP methods
   - DRF serializers for validation

4. **Email Integration** ⭐⭐⭐
   - Multiple providers (SendGrid, SMTP)
   - Magic links for passwordless auth
   - HTML + text email templates

---

## 📈 SUGGESTED IMPROVEMENTS

### High Priority
1. **Remove all debug code** - Replace print statements with proper logging
2. **Add database indexing** - Index frequently queried fields (company_id, year, month)
3. **Implement caching** - Add Redis for dashboard calculations
4. **Add pagination** - All list endpoints should have pagination
5. **Fix security issues** - Add rate limiting, input sanitization, proper secrets management

### Medium Priority
6. **Move to Vite** - Replace Create React App for faster builds
7. **Add TypeScript** - Type safety on frontend
8. **Implement Celery** - Background jobs for email, data processing
9. **Add S3 storage** - Scale file uploads
10. **Create audit trail** - Track all data changes for compliance

### Low Priority
11. **Add data export** - CSV/PDF reports
12. **Multi-language support** - Arabic + English
13. **Automated reminders** - Email notifications for deadlines
14. **Mobile app** - React Native for on-the-go data entry
15. **Analytics** - Advanced reporting and trends

---

# 🚀 COMPREHENSIVE BUILD PROMPT
## ESG Portal v2.0 - FastAPI + React Modern SaaS Platform

> Use this prompt to build a completely new, improved version of the ESG Portal from scratch using FastAPI (backend) and React (frontend).

---

## 📋 PRODUCT OVERVIEW

**Product Name**: ESG Portal v2.0
**Product Type**: B2B SaaS Compliance Automation Platform
**Target Market**: SMEs in UAE Hospitality Sector (expandable to other sectors)
**Core Purpose**: Transform complex ESG (Environmental, Social, Governance) reporting requirements into simple, automated workflows

### Business Goals
1. Reduce ESG compliance reporting time by 70%
2. Eliminate manual spreadsheet tracking
3. Provide audit-ready documentation
4. Real-time progress monitoring for management
5. Automated framework requirement matching based on company profile

### Key User Personas
- **Company Owner**: Sets up company, invites team members
- **Compliance Manager**: Configures frameworks, reviews progress
- **Data Entry Staff**: Inputs monthly environmental data
- **Auditor**: Reviews evidence documents, validates compliance
- **Administrator**: Manages users, permissions, settings

---

## 👥 ROLE-BASED ACCESS CONTROL (RBAC)

### **Role Hierarchy System**

The ESG Portal implements a 6-tier role hierarchy with granular permissions:

### **1. Super User** 🔴
**Description**: Company CEO/Owner with full control over their company
**Level**: Highest company role (Level 1)
**Use Case**: Company owners, CEOs, top-level executives
**IMPORTANT**: This is the highest role WITHIN a company, but CANNOT access Developer Admin Panel

**Create Permissions**:
- ✅ Create admin, site_manager, uploader, viewer, meter_manager roles for their company
- ✅ Create users for their company
- ✅ Create meters
- ✅ Create data submissions

**Read Permissions**:
- ✅ Access all company data (their company only)
- ✅ View all users in their company
- ✅ View frameworks and profiling questions
- ✅ View meters and data submissions (their company only)
- ✅ View dashboard and reports
- ✅ View audit logs (their company only)

**Update Permissions**:
- ✅ Update company profile (their company only)
- ✅ Update users with lower roles in their company (admin, site_manager, uploader, viewer, meter_manager)
- ✅ ✗ Cannot edit other Super Users
- ✅ Update profiling answers
- ✅ Update meters
- ✅ Update data submissions

**Delete Permissions**:
- ✅ Delete users with lower roles in their company (admin, site_manager, uploader, viewer, meter_manager)
- ✅ Delete meters
- ✅ ✗ Cannot delete other Super Users
- ✗ Cannot delete companies (deactivation only)

**Special Permissions**:
- ✅ Company-wide data access (their company only)
- ✅ User management (for their company only)
- ✅ Task assignment for data collection
- ✅ Export company reports

**What They See**:
- User management panel (their company)
- Company settings (their company)
- All data collection views (their company)
- Complete dashboard (their company)
- Task assignment interface

**Restrictions**:
- ❌ CANNOT access Developer Admin Panel (`/dev-admin/*`) - EXCLUSIVE TO PLATFORM DEVELOPER ONLY
- ❌ CANNOT view system health or feature flags
- ❌ CANNOT view other companies' data
- ❌ CANNOT edit other Super Users
- ❌ CANNOT delete company (only deactivate)

---

### **2. Admin** 🟠
**Description**: Company manager reporting to Super User (CEO/Owner)
**Level**: High company role (Level 2)
**Use Case**: Compliance managers, ESG consultants, operations managers
**Reports to**: Super User (Company CEO/Owner)

**Create Permissions**:
- ✅ Create site_manager, uploader, viewer, meter_manager roles
- ✅ Create users for their company
- ✅ Create meters
- ✅ Create data submissions

**Read Permissions**:
- ✅ Access all company data
- ✅ View company users
- ✅ View frameworks and profiling questions
- ✅ View meters and data submissions
- ✅ View dashboard and reports
- ✅ View audit logs (company-specific)

**Update Permissions**:
- ✅ Update users with lower roles (site_manager, uploader, viewer, meter_manager)
- ✅ ✗ Cannot edit Super Users or other Admins
- ✅ Update profiling answers
- ✅ Update meters
- ✅ Update data submissions

**Delete Permissions**:
- ✅ Delete users with lower roles (site_manager, uploader, viewer, meter_manager)
- ✅ Delete meters
- ✗ Cannot delete Super Users or other Admins

**Special Permissions**:
- ✅ Company-wide data access
- ✅ User management (for lower roles only)
- ✅ Task assignment for data collection
- ✅ Export company reports

**What They See**:
- User management panel (lower roles only)
- All data collection views
- Framework management
- Complete dashboard
- Task assignment interface

**Restrictions**:
- ❌ CANNOT access Developer Admin Panel (`/dev-admin/*`) - EXCLUSIVE TO PLATFORM DEVELOPER ONLY
- ❌ Cannot manage Super User or other Admins
- ❌ Cannot view other companies' data
- ❌ Cannot edit company profile (only Super User can)

---

### **3. Site Manager** 🟡
**Description**: Site/location manager with operational oversight
**Level**: Medium-High (Level 3)
**Use Case**: Hotel general managers, site supervisors, facility managers

**Create Permissions**:
- ✅ Create uploader, viewer, meter_manager roles
- ✅ Create meters
- ✅ Create data submissions
- ✅ Create task assignments

**Read Permissions**:
- ✅ View company onboarding
- ✅ View framework selection
- ✅ View data checklist
- ✅ View meters
- ✅ View data collection
- ✅ View dashboard and reports

**Update Permissions**:
- ✅ Update users with lower roles (uploader, viewer, meter_manager)
- ✅ ✗ Cannot edit other site managers, admins, or super users
- ✅ Update meters
- ✅ Update data submissions

**Delete Permissions**:
- ✅ Delete users with lower roles (uploader, viewer, meter_manager)
- ✅ Delete meters
- ✗ Cannot delete other site managers, admins, or super users

**Special Permissions**:
- ✅ Task assignment for data collection
- ✅ Meter management
- ✅ Data review capabilities
- ✅ Site-specific reporting

**What They See**:
- Site-specific dashboard
- Task assignment interface
- User management (lower roles)
- Meter management
- Data collection review
- Site performance reports

**Restrictions**:
- ❌ Cannot access company settings
- ❌ Cannot manage frameworks
- ❌ Cannot view other sites' data (in multi-site companies)
- ❌ Cannot edit admin or higher roles

---

### **4. Uploader** 🟢
**Description**: Data entry specialist focused on data collection
**Level**: Medium (Level 4)
**Use Case**: Data entry clerks, facility staff, sustainability coordinators

**Create Permissions**:
- ✅ Create data submissions
- ✅ Upload evidence files

**Read Permissions**:
- ✅ View company onboarding
- ✅ View framework selection
- ✅ View data checklist
- ✅ View data collection
- ✅ View dashboard
- ✅ View assigned tasks

**Update Permissions**:
- ✅ Update their own data submissions
- ✅ Update evidence files
- ✗ Cannot update user profiles or meters

**Delete Permissions**:
- ✗ Cannot delete users or meters
- ✗ Can only remove evidence files from their submissions

**Special Permissions**:
- ✅ Data entry focus
- ✅ Task-based workflow
- ✗ No user management capabilities

**What They See**:
- Data collection interface
- Task list (assigned data entries)
- Dashboard (read-only)
- Their submission history
- Evidence file management

**Restrictions**:
- ❌ Cannot access user management
- ❌ Cannot edit meters
- ❌ Cannot view other users' submissions
- ❌ Cannot modify framework settings
- ❌ Cannot export reports (only view)

---

### **5. Viewer** 🔵
**Description**: Read-only access for monitoring and reporting
**Level**: Low-Medium (Level 5)
**Use Case**: Executives, auditors, external consultants, stakeholders

**Create Permissions**:
- ✗ No create permissions

**Read Permissions**:
- ✅ View company onboarding
- ✅ View framework selection
- ✅ View data checklist
- ✅ View meters (read-only)
- ✅ View data collection (read-only)
- ✅ View dashboard
- ✅ View and export reports

**Update Permissions**:
- ✗ No update permissions

**Delete Permissions**:
- ✗ No delete permissions

**Special Permissions**:
- ✅ Read-only access
- ✅ Report export capabilities (CSV, PDF)
- ✅ View all company data
- ✗ Cannot modify any data

**What They See**:
- Dashboard (full read access)
- Reports and analytics
- Data collection (view only)
- Framework compliance status
- Export options

**Restrictions**:
- ❌ Cannot modify any data
- ❌ Cannot access user management
- ❌ Cannot upload evidence files
- ❌ Cannot edit company settings

---

### **6. Meter Manager** 🟣
**Description**: Meter infrastructure specialist
**Level**: Medium (Level 4)
**Use Case**: Facility engineers, utility managers, maintenance staff

**Create Permissions**:
- ✅ Create meters
- ✅ Create data submissions (metered data only)

**Read Permissions**:
- ✅ View company onboarding
- ✅ View framework selection
- ✅ View data checklist
- ✅ View meters (full access)
- ✅ View data collection (meter-focused)
- ✅ View dashboard

**Update Permissions**:
- ✅ Update meters
- ✅ Update meter-related data submissions
- ✗ Cannot update user profiles or framework data

**Delete Permissions**:
- ✅ Delete meters (with data validation)
- ✗ Cannot delete users or other data

**Special Permissions**:
- ✅ Meter management focus
- ✗ Limited data entry capabilities (meter data only)

**What They See**:
- Meter management interface
- Meter-related data elements
- Meter reading history
- Dashboard (meter-focused)
- Evidence files for meter data

**Restrictions**:
- ❌ Cannot access user management
- ❌ Cannot edit non-metered data elements
- ❌ Cannot modify framework settings
- ❌ Cannot manage other users

---

### **Permission Matrix**

| Feature/Resource | Super User | Admin | Site Manager | Uploader | Viewer | Meter Manager |
|------------------|-----------|-------|--------------|----------|--------|---------------|
| **User Management** | | | | | | |
| Create users (any role) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create users (limited)* | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit users (higher roles) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edit users (lower roles) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete users | ✅ | Limited | Limited | ❌ | ❌ | ❌ |
| **Company Management** | | | | | | |
| Create companies | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edit company profile | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete companies | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View companies | All | Own | Own | Own | Own | Own |
| **Framework Management** | | | | | | |
| Assign frameworks | ✅ | Voluntary | ❌ | ❌ | ❌ | ❌ |
| View frameworks | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit profiling questions | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Meter Management** | | | | | | |
| Create meters | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Edit meters | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Delete meters | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| View meters | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Data Collection** | | | | | | |
| Create submissions | ✅ | ✅ | ✅ | ✅ | ❌ | Metered only |
| Edit submissions | ✅ | ✅ | ✅ | Own | ❌ | Metered only |
| Delete submissions | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Upload evidence | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Dashboard & Reports** | | | | | | |
| View dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Export reports | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| View analytics | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **System Administration** | | | | | | |
| Access Developer Admin Panel | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View system health | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Feature flags | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Audit logs (all) | All | Company | Company | ❌ | ❌ | ❌ |

**⚠️ CRITICAL: Developer Admin Panel Access**
The **Developer Admin Panel** (`/dev-admin/*`) is **EXCLUSIVELY** for the platform developer (you).

**NO SYSTEM USER** (including Super User, Admin, or any other role) can access this panel.

**Access is controlled by:**
- Special `IS_PLATFORM_DEVELOPER` environment variable
- Separate authentication mechanism (developer-specific API key)
- IP whitelist restriction (only developer's IP)
- Completely isolated from role-based permissions

**Developer Admin Panel Features** (ONLY for you):
- System health monitoring
- Feature flag management
- Database management tools
- Cross-company data access
- Platform-wide analytics
- System configuration
- Audit logs (all companies)
- API performance monitoring

---

### **Implementation Example (FastAPI)**

```python
# core/permissions.py
from enum import Enum
from typing import List

class Role(str, Enum):
    SUPER_USER = "super_user"
    ADMIN = "admin"
    SITE_MANAGER = "site_manager"
    UPLOADER = "uploader"
    VIEWER = "viewer"
    METER_MANAGER = "meter_manager"

# Platform Developer (separate from role system)
IS_PLATFORM_DEVELOPER = os.getenv("IS_PLATFORM_DEVELOPER", "false") == "true"

# Role hierarchy (higher roles can manage lower roles)
# NOTE: Super User is the highest role within a COMPANY, but cannot access Developer Admin Panel
ROLE_HIERARCHY = {
    Role.SUPER_USER: [
        Role.ADMIN, Role.SITE_MANAGER,
        Role.UPLOADER, Role.VIEWER, Role.METER_MANAGER
    ],
    Role.ADMIN: [
        Role.SITE_MANAGER,
        Role.UPLOADER, Role.VIEWER, Role.METER_MANAGER
    ],
    Role.SITE_MANAGER: [
        Role.UPLOADER, Role.VIEWER, Role.METER_MANAGER
    ]
}

# Resource permissions
class Permission(str, Enum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"

# Platform developer permissions (separate from role system)
PLATFORM_DEVELOPER_PERMISSIONS = {
    "users": {Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE},
    "companies": {Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE},
    "frameworks": {Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE},
    "meters": {Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE},
    "data_submissions": {Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE},
    "dashboard": {Permission.READ},
    "dev_admin_panel": {Permission.READ, Permission.UPDATE, Permission.DELETE},
    "system_health": {Permission.READ},
    "feature_flags": {Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE},
    "audit_logs": {Permission.READ},
    "database_management": {Permission.READ, Permission.UPDATE}
}

ROLE_PERMISSIONS = {
    # Super User = Company CEO/Owner (highest within company, but NO platform admin access)
    Role.SUPER_USER: {
        "users": {Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE},
        "companies": {Permission.READ, Permission.UPDATE},  # Can edit own company only
        "frameworks": {Permission.READ, Permission.UPDATE},  # Voluntary assignments
        "meters": {Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE},
        "data_submissions": {Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE},
        "dashboard": {Permission.READ}
    },
    # Admin = Company Manager (reports to Super User)
    Role.ADMIN: {
        "users": {Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE},
        "companies": {Permission.READ},  # Read-only
        "frameworks": {Permission.READ},
        "meters": {Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE},
        "data_submissions": {Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE},
        "dashboard": {Permission.READ}
    },
    Role.SITE_MANAGER: {
        "users": {Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE},
        "meters": {Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE},
        "data_submissions": {Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE},
        "dashboard": {Permission.READ}
    },
    Role.UPLOADER: {
        "data_submissions": {Permission.CREATE, Permission.READ, Permission.UPDATE},
        "dashboard": {Permission.READ}
    },
    Role.VIEWER: {
        "data_submissions": {Permission.READ},
        "dashboard": {Permission.READ},
        "reports": {Permission.READ}
    },
    Role.METER_MANAGER: {
        "meters": {Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE},
        "data_submissions": {Permission.CREATE, Permission.READ, Permission.UPDATE},
        "dashboard": {Permission.READ}
    }
}

# Permission checking function
def has_permission(user_role: Role, resource: str, permission: Permission) -> bool:
    """Check if user has permission for resource"""
    role_perms = ROLE_PERMISSIONS.get(user_role, {})
    resource_perms = role_perms.get(resource, set())
    return permission in resource_perms

# Platform developer check (completely separate from roles)
def is_platform_developer(request) -> bool:
    """Check if request is from platform developer"""
    # Check for special developer API key in headers
    dev_api_key = request.headers.get("X-Developer-API-Key")
    if dev_api_key != os.getenv("DEVELOPER_API_KEY"):
        return False

    # Check IP whitelist
    if request.client.host not in os.getenv("DEVELOPER_IP_WHITELIST", "").split(","):
        return False

    # Check environment variable
    if os.getenv("IS_PLATFORM_DEVELOPER", "false") != "true":
        return False

    return True

# Unified permission check that includes platform developer
def has_permission_or_is_developer(user_role: Role, resource: str, permission: Permission, request) -> bool:
    """Check if user has permission OR is platform developer (for dev admin panel only)"""
    # Platform developer has access to dev admin panel only
    if resource == "dev_admin_panel":
        return is_platform_developer(request)

    # All other resources use normal RBAC
    return has_permission(user_role, resource, permission)

# Role hierarchy checking
def can_manage_role(manager_role: Role, target_role: Role) -> bool:
    """Check if manager role can manage target role"""
    manageable_roles = ROLE_HIERARCHY.get(manager_role, [])
    return target_role in manageable_roles
```

**Usage in FastAPI routes:**

```python
# api/users.py
from fastapi import Depends, HTTPException, status
from core.permissions import Role, has_permission, can_manage_role
from core.dependencies import get_current_user

@router.post("/users/")
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_user)
):
    # Check if current user can create users
    if not has_permission(current_user.role, "users", Permission.CREATE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied"
        )

    # Check if current user can assign the requested role
    if not can_manage_role(current_user.role, user_data.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cannot assign role {user_data.role}"
        )

    # Create user...
```

**Developer Admin Panel (EXCLUSIVE ACCESS):**

```python
# api/dev_admin.py
from fastapi import Depends, HTTPException, status
from core.permissions import is_platform_developer

@router.get("/dev-admin/system-health")
async def get_system_health(request: Request):
    """ONLY accessible by platform developer"""
    if not is_platform_developer(request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Developer admin panel is for platform developer only."
        )

    # Return system health metrics
    return {
        "database": "healthy",
        "redis": "healthy",
        "celery": "running",
        "active_companies": 42,
        "total_users": 150
    }

@router.post("/dev-admin/feature-flags")
async def update_feature_flag(
    flag_name: str,
    enabled: bool,
    request: Request
):
    """ONLY accessible by platform developer"""
    if not is_platform_developer(request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Developer admin panel is for platform developer only."
        )

    # Update feature flag
    await feature_service.update_flag(flag_name, enabled)
    return {"message": f"Feature flag {flag_name} updated to {enabled}"}
```

**Environment Variables for Developer Access:**

```bash
# .env (backend)
IS_PLATFORM_DEVELOPER=true  # Only true in development/on your machine
DEVELOPER_API_KEY=your-super-secret-developer-key-here
DEVELOPER_IP_WHITELIST=127.0.0.1,192.168.1.100,your-office-ip

# Developer Admin Panel Route
DEV_ADMIN_PREFIX=/dev-admin  # Separate from regular /admin/ routes
```

**Frontend TypeScript implementation:**

```typescript
// types/permissions.ts
export enum Role {
  SUPER_USER = 'super_user',
  ADMIN = 'admin',
  SITE_MANAGER = 'site_manager',
  UPLOADER = 'uploader',
  VIEWER = 'viewer',
  METER_MANAGER = 'meter_manager'
}

export enum Permission {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete'
}

// Note: Platform developer is NOT a role - it's a completely separate access mechanism
// controlled by environment variables and API keys

interface RolePermissions {
  [resource: string]: Permission[]
}

export const ROLE_PERMISSIONS: Record<Role, RolePermissions> = {
  [Role.SUPER_USER]: {
    users: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
    companies: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
    frameworks: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
    meters: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
    data_submissions: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
    dashboard: [Permission.READ]
  },
  [Role.ADMIN]: {
    users: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
    companies: [Permission.READ, Permission.UPDATE],
    frameworks: [Permission.READ, Permission.UPDATE],
    meters: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
    data_submissions: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
    dashboard: [Permission.READ]
  },
  [Role.SITE_MANAGER]: {
    users: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
    meters: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
    data_submissions: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
    dashboard: [Permission.READ]
  },
  [Role.UPLOADER]: {
    data_submissions: [Permission.CREATE, Permission.READ, Permission.UPDATE],
    dashboard: [Permission.READ]
  },
  [Role.VIEWER]: {
    data_submissions: [Permission.READ],
    dashboard: [Permission.READ],
    reports: [Permission.READ]
  },
  [Role.METER_MANAGER]: {
    meters: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
    data_submissions: [Permission.CREATE, Permission.READ, Permission.UPDATE],
    dashboard: [Permission.READ]
  }
};

// hooks/usePermissions.ts
export function usePermissions() {
  const { user } = useAuth();

  const hasPermission = (resource: string, permission: Permission): boolean => {
    if (!user) return false;

    const rolePermissions = ROLE_PERMISSIONS[user.role];
    if (!rolePermissions) return false;

    const resourcePermissions = rolePermissions[resource];
    return resourcePermissions?.includes(permission) ?? false;
  };

  const canManageRole = (targetRole: Role): boolean => {
    if (!user) return false;

    const hierarchy: Record<Role, Role[]> = {
      // Super User (Company CEO/Owner) - Can manage Admin and below, but NOT other Super Users
      [Role.SUPER_USER]: [Role.ADMIN, Role.SITE_MANAGER, Role.UPLOADER, Role.VIEWER, Role.METER_MANAGER],
      // Admin - Can manage Site Manager and below, but NOT Super User or other Admins
      [Role.ADMIN]: [Role.SITE_MANAGER, Role.UPLOADER, Role.VIEWER, Role.METER_MANAGER],
      // Site Manager - Can manage Uploader, Viewer, Meter Manager
      [Role.SITE_MANAGER]: [Role.UPLOADER, Role.VIEWER, Role.METER_MANAGER]
    };

    const manageableRoles = hierarchy[user.role] ?? [];
    return manageableRoles.includes(targetRole);
  };

  return { hasPermission, canManageRole };
}

// components/ProtectedAction.tsx
interface ProtectedActionProps {
  resource: string;
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ProtectedAction({ resource, permission, children, fallback }: ProtectedActionProps) {
  const { hasPermission } = usePermissions();

  if (!hasPermission(resource, permission)) {
    return <>{fallback || null}</>;
  }

  return <>{children}</>;
}

// Usage in components
function UserManagement() {
  const { hasPermission } = usePermissions();

  return (
    <div>
      <h1>User Management</h1>

      <ProtectedAction resource="users" permission={Permission.CREATE}>
        <Button onClick={handleCreateUser}>Create User</Button>
      </ProtectedAction>

      <ProtectedAction
        resource="users"
        permission={Permission.DELETE}
        fallback={<Tooltip>You don't have permission to delete users</Tooltip>}
      >
        <Button onClick={handleDeleteUser}>Delete User</Button>
      </ProtectedAction>
    </div>
  );
}

// Developer Admin Panel - COMPLETELY SEPARATE
// This is NOT part of the regular role system
// Only accessible via separate authentication mechanism

function DevAdminPanel() {
  const { isDeveloper } = useDevAuth(); // Separate auth hook

  if (!isDeveloper) {
    return <AccessDenied message="Developer admin panel is for platform developer only" />;
  }

  return (
    <div>
      <h1>🔧 Developer Admin Panel</h1>
      <SystemHealthMonitor />
      <FeatureFlagManager />
      <DatabaseManagement />
      <AuditLogViewer />
    </div>
  );
}

// hooks/useDevAuth.ts
export function useDevAuth() {
  // This checks for developer-specific authentication
  // completely separate from regular user authentication
  const [isDeveloper, setIsDeveloper] = useState(false);

  useEffect(() => {
    // Check if developer API key is present
    const devApiKey = localStorage.getItem('dev_api_key');
    const isValidKey = devApiKey === import.meta.env.VITE_DEVELOPER_API_KEY;

    setIsDeveloper(isValidKey);
  }, []);

  return { isDeveloper };
}
```

---

## 🎯 CORE FEATURES TO IMPLEMENT

### 1. Authentication & User Management
**Requirements:**
- JWT-based authentication (access tokens + refresh tokens)
- Role-based access control (6 roles: super_user, admin, site_manager, uploader, viewer, meter_manager)
- Email verification with magic links
- Password reset via email
- Company-scoped permissions (users belong to companies)
- Multi-user support per company
- User invitation system

**Implementation:**
- FastAPI `security.HTTPBearer()` for JWT validation
- `passlib` + `bcrypt` for password hashing
- `python-jose` for JWT token management
- Email service integration (SendGrid/SMTP)
- Redis for token blacklisting (logout)

### 2. Company Onboarding
**Requirements:**
- Multi-step company registration wizard
- Company profile: name, emirate (7 UAE emirates), sector (9+ sectors)
- Business activity selection (pre-defined + custom activities)
- Automatic framework assignment based on profile:
  - **ESG Core**: All companies (mandatory)
  - **DST (Dubai Sustainable Tourism)**: Dubai + Hospitality only (mandatory)
  - **Green Key**: Voluntary certification
- Framework assignment stored as JSON array: `["ESG", "DST", "GREEN_KEY"]`

**Implementation:**
- React multi-step form with `react-hook-form`
- Backend: `FrameworkService.assign_mandatory_frameworks(emirate, sector)`
- Database: Company table with `active_frameworks` JSONB field

### 3. Intelligent Profiling Wizard
**Requirements:**
- Dynamic questionnaire based on assigned frameworks
- Yes/No questions about business operations
- Generates personalized data element checklist
- De-duplication across frameworks (same element in multiple frameworks = show once)
- Frequency consolidation (Monthly > Quarterly > Annually)
- Auto-create "Main" meters for metered data elements

**Example Flow:**
1. Company assigned ESG + DST frameworks
2. System loads 22 profiling questions
3. User answers questions (e.g., "Do you have on-site laundry?" → Yes)
4. System generates checklist with 45 relevant data elements
5. Auto-creates meters for Electricity, Water, Fuel elements

**Implementation:**
- Backend: `ProfilingService.generate_checklist(company, framework_answers)`
- Database: `ProfilingQuestion`, `CompanyProfileAnswer`, `CompanyChecklist` tables
- Frontend: Multi-step wizard with progress indicator

### 4. Meter Management
**Requirements:**
- Full CRUD for measurement devices
- Meter types: Electricity, Water, Fuel, LPG, Others
- Attributes: name, meter_type, account_number, location, is_active
- Auto-create "Main" meters during checklist generation
- Cannot delete meters with associated data (soft delete/deactivate only)
- Multi-site support (meters belong to sites)

**Implementation:**
- RESTful endpoints: `/api/companies/{id}/meters/`
- Database: Meter table with `company_id`, `data_element_id`, `is_active` fields
- Validation: Check for existing data before deletion

### 5. Data Collection System
**Requirements:**
- Month-centric data entry interface (year + month selection)
- Support for metered and non-metered data elements
- Data value fields: numeric values, units, notes
- Evidence file upload (PDF, images, documents)
- Auto-match evidence files to data elements
- Progress tracking (monthly + annual)
- Validation: Required fields, data type checks, reasonable ranges
- Bulk data import (CSV upload)

**Data Structure:**
```python
DataSubmission {
  company_id,
  data_element_id,
  meter_id (nullable),
  year,
  month,
  value,
  unit,
  notes,
  evidence_files (JSON array of file paths),
  submitted_by,
  submitted_at
}
```

**Implementation:**
- Frontend: Dynamic form based on checklist (filtered by month/year)
- Backend: `DataCollectionService.submit_data()` with validation
- File storage: AWS S3 or similar (not local filesystem)
- Progress calculation: Real-time dashboard updates

### 6. Dashboard & Analytics
**Requirements:**
- Real-time metrics: Total frameworks, data elements, meters, completion rate
- Monthly progress: % data entered, % evidence uploaded
- Annual progress: Year-to-date completion
- Visual charts: Bar charts, progress bars, trend lines
- Task list: Overdue, upcoming, completed tasks
- Export functionality: CSV, PDF reports
- Data trends: Month-over-month comparisons

**Implementation:**
- Backend: `DashboardService.calculate_progress(company, year, month)`
- Caching: Redis for expensive calculations (TTL: 5 minutes)
- Frontend: Chart.js or Recharts for visualizations
- Optimized queries: Database aggregation, not in-memory calculation

### 7. Admin Panel
**Requirements:**
- User management: Invite, edit roles, deactivate
- Company settings: Framework assignment, profile updates
- Data element management: Add/edit ESG elements
- Profiling question editor: Create/update questions
- System health: API status, database connections, Redis status
- Audit logs: Track all data changes (WHO, WHAT, WHEN)

**Implementation:**
- Separate admin routes: `/admin/*`
- Detailed audit logging: `AuditLog` table with action, entity_id, changes
- Role-based UI: Different views for different roles

---

## 🗄️ DATABASE SCHEMA (PostgreSQL)

```sql
-- Users & Authentication
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'super_user', 'admin', 'site_manager', 'uploader', 'viewer', 'meter_manager'
  site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
  must_reset_password BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Companies
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  company_code VARCHAR(10) UNIQUE NOT NULL, -- e.g., DXB001
  emirate VARCHAR(50) NOT NULL, -- 'dubai', 'abu_dhabi', etc.
  sector VARCHAR(50) NOT NULL, -- 'hospitality', 'real_estate', etc.
  active_frameworks JSONB DEFAULT '["ESG"]', -- ['ESG', 'DST', 'GREEN_KEY']
  has_green_key BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sites (multi-location support)
CREATE TABLE sites (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Frameworks
CREATE TABLE frameworks (
  id SERIAL PRIMARY KEY,
  framework_id VARCHAR(10) UNIQUE NOT NULL, -- 'ESG', 'DST', 'GREEN_KEY'
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'mandatory', 'voluntary', 'conditional'
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE company_frameworks (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  framework_id INTEGER REFERENCES frameworks(id) ON DELETE CASCADE,
  is_auto_assigned BOOLEAN DEFAULT FALSE,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, framework_id)
);

-- Data Elements
CREATE TABLE data_elements (
  id SERIAL PRIMARY KEY,
  element_code VARCHAR(20) UNIQUE NOT NULL, -- 'ELEC-001', 'WATER-001'
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'Energy', 'Water', 'Waste', etc.
  description TEXT,
  unit VARCHAR(50), -- 'kWh', 'm³', 'tonnes'
  collection_frequency VARCHAR(20) NOT NULL, -- 'Monthly', 'Quarterly', 'Annually'
  is_metered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Profiling Questions
CREATE TABLE profiling_questions (
  id SERIAL PRIMARY KEY,
  framework_id INTEGER REFERENCES frameworks(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_order INTEGER NOT NULL,
  requires_meter BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE company_profile_answers (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES profiling_questions(id) ON DELETE CASCADE,
  answer BOOLEAN NOT NULL, -- Yes/No
  answered_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  answered_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, question_id)
);

-- Checklist
CREATE TABLE company_checklists (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  data_element_id INTEGER REFERENCES data_elements(id) ON DELETE CASCADE,
  framework_id INTEGER REFERENCES frameworks(id) ON DELETE CASCADE,
  frequency VARCHAR(20) NOT NULL,
  is_required BOOLEAN DEFAULT TRUE,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, data_element_id)
);

-- Meters
CREATE TABLE meters (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
  data_element_id INTEGER REFERENCES data_elements(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, -- e.g., "Main Electricity Meter"
  meter_type VARCHAR(50) NOT NULL, -- 'Electricity', 'Water', 'Fuel'
  account_number VARCHAR(100),
  location VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Data Submissions
CREATE TABLE data_submissions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
  data_element_id INTEGER REFERENCES data_elements(id) ON DELETE CASCADE,
  meter_id INTEGER REFERENCES meters(id) ON DELETE SET NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL, -- 1-12
  value DECIMAL(20, 4),
  unit VARCHAR(50),
  notes TEXT,
  evidence_files JSONB DEFAULT '[]', -- ['s3://bucket/path/to/file.pdf']
  submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, data_element_id, year, month)
);

-- Audit Logs
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'view'
  entity_type VARCHAR(50) NOT NULL, -- 'company', 'data_submission', 'meter'
  entity_id INTEGER NOT NULL,
  changes JSONB, -- {before: {...}, after: {...}}
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX idx_companies_emirate_sector ON companies(emirate, sector);
CREATE INDEX idx_data_submissions_company_year_month ON data_submissions(company_id, year, month);
CREATE INDEX idx_company_checklists_company ON company_checklists(company_id);
CREATE INDEX idx_meters_company ON meters(company_id, is_active);
CREATE INDEX idx_audit_logs_company_created ON audit_logs(company_id, created_at);
```

---

## 🔄 KEY USER FLOWS

### Flow 1: New Company Onboarding
```
1. User signs up → Email verification
2. Creates company profile (name, emirate, sector)
3. System auto-assigns frameworks (ESG mandatory, DST if Dubai+Hospitality)
4. User selects business activities
5. System generates profiling questionnaire
6. User answers Yes/No questions
7. System generates personalized checklist (45 relevant data elements)
8. System auto-creates "Main" meters for metered elements
9. User redirected to dashboard
```

### Flow 2: Monthly Data Entry
```
1. User navigates to Data Collection
2. Selects year/month (default: current month)
3. System displays relevant data elements (filtered by frequency)
4. User enters values (numeric) + uploads evidence files
5. System validates data (required fields, ranges)
6. User submits data
7. System updates progress metrics
8. Dashboard shows real-time completion rate
```

### Flow 3: Progress Review
```
1. Compliance Manager opens dashboard
2. Views monthly progress: 75% complete, 20/30 elements submitted
3. Clicks "Missing Data" filter
4. Sees 10 data elements still needed
5. Sends reminder email to data entry team
6. Tracks overdue items
```

---

## 🏗️ ARCHITECTURE INSTRUCTIONS

### Backend (FastAPI)

**Tech Stack:**
- **FastAPI 0.104+** - Modern async Python web framework
- **SQLAlchemy 2.0+** - ORM with async support
- **Alembic** - Database migrations
- **Pydantic v2** - Data validation
- **python-jose** - JWT authentication
- **passlib[bcrypt]** - Password hashing
- **Redis** - Caching + session storage
- **Celery** - Background tasks (emails, data processing)
- **SendGrid** - Email service
- **AWS S3** - File storage
- **PostgreSQL** - Production database

**Project Structure:**
```
backend/
├── app/
│   ├── main.py                 # FastAPI app initialization
│   ├── config.py               # Settings management
│   ├── dependencies.py         # Dependency injection
│   │
│   ├── models/                 # SQLAlchemy models
│   │   ├── user.py
│   │   ├── company.py
│   │   ├── framework.py
│   │   ├── data_element.py
│   │   ├── checklist.py
│   │   ├── meter.py
│   │   ├── submission.py
│   │   └── audit.py
│   │
│   ├── schemas/                # Pydantic schemas
│   │   ├── user.py
│   │   ├── company.py
│   │   ├── framework.py
│   │   ├── data_element.py
│   │   ├── checklist.py
│   │   ├── meter.py
│   │   ├── submission.py
│   │   └── dashboard.py
│   │
│   ├── api/                    # API routes
│   │   ├── deps.py             # Route dependencies (auth, company access)
│   │   ├── auth.py             # Login, signup, password reset
│   │   ├── companies.py        # Company CRUD
│   │   ├── frameworks.py       # Framework management
│   │   ├── profiling.py        # Profiling wizard
│   │   ├── meters.py           # Meter CRUD
│   │   ├── submissions.py      # Data collection
│   │   ├── dashboard.py        # Progress metrics
│   │   └── admin.py            # Admin panel
│   │
│   ├── services/               # Business logic
│   │   ├── auth_service.py
│   │   ├── framework_service.py
│   │   ├── profiling_service.py
│   │   ├── checklist_service.py
│   │   ├── meter_service.py
│   │   ├── data_service.py
│   │   ├── dashboard_service.py
│   │   └── email_service.py
│   │
│   ├── core/                   # Core utilities
│   │   ├── security.py         # JWT, password hashing
│   │   ├── cache.py            # Redis caching
│   │   ├── s3.py               # AWS S3 file storage
│   │   └── logger.py           # Structured logging (NO print statements!)
│   │
│   ├── workers/                # Celery tasks
│   │   ├── email_tasks.py
│   │   └── data_tasks.py
│   │
│   └── db/                     # Database
│       ├── session.py          # Database session management
│       └── migrations/         # Alembic migrations
│
├── tests/
│   ├── test_api/
│   ├── test_services/
│   └── test_fixtures.py
│
├── alembic.ini
├── pyproject.toml
└── requirements.txt
```

**Key Implementation Details:**

1. **Authentication:**
```python
# JWT Middleware
async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await db.get(User, user_id)
    if user is None:
        raise credentials_exception
    return user

# Rate Limiting
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)
```

2. **Company Access Control:**
```python
# Dependency to validate company access
async def get_company_access(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Company:
    # Check if user belongs to company
    company = await company_service.get_user_company(current_user.id, company_id)
    if not company:
        raise HTTPException(403, "Access denied")
    return company
```

3. **Caching Strategy:**
```python
# Cache expensive dashboard calculations
@cache(ttl=300, key=lambda company_id, year, month: f"progress:{company_id}:{year}:{month}")
async def calculate_progress(company_id: int, year: int, month: int):
    # Expensive database query
    return result
```

4. **Background Tasks:**
```python
# Send verification email asynchronously
@celery_app.task
def send_verification_email(user_email: str, token: str):
    html_content = render_email_template("verification.html", {"token": token})
    email_service.send(user_email, "Verify your email", html_content)
```

### Frontend (React + TypeScript)

**Tech Stack:**
- **React 18+** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool (NOT Create React App)
- **React Router v6** - Client routing
- **React Query (TanStack Query)** - API state management
- **Zustand** - Global state (auth, theme)
- **React Hook Form** - Form handling
- **Tailwind CSS** - Styling
- **Recharts** - Data visualization
- **Axios** - HTTP client

**Project Structure:**
```
frontend/
├── src/
│   ├── main.tsx               # App entry
│   ├── App.tsx                # Root component + Router setup
│   │
│   ├── pages/                 # Page components
│   │   ├── Authentication/
│   │   │   ├── Login.tsx           # Login page with email/password
│   │   │   ├── Signup.tsx          # User registration
│   │   │   ├── EmailVerification.tsx  # Email verification with magic link
│   │   │   ├── ResetPassword.tsx  # Password reset flow
│   │   │   ├── SetupAccount.tsx   # First-time account setup
│   │   │   └── ChangePassword.tsx # Password change form
│   │   │
│   │   ├── Onboarding/
│   │   │   ├── Onboarding.tsx     # Company registration wizard
│   │   │   ├── FrameworkSelection.tsx  # Framework assignment (ESG, DST, Green Key)
│   │   │   ├── ActivitySelection.tsx  # Business activity selection
│   │   │   └── ProfilingWizard.tsx    # Dynamic questionnaire for data elements
│   │   │
│   │   ├── Dashboard/
│   │   │   ├── Dashboard.tsx       # Main dashboard with metrics
│   │   │   ├── DashboardHome.tsx   # Dashboard home/overview
│   │   │   ├── UnifiedDashboard.tsx  # Unified dashboard view
│   │   │   └── Reports.tsx         # Reports and analytics
│   │   │
│   │   ├── Data Management/
│   │   │   ├── DataCollection.tsx  # Monthly data entry interface
│   │   │   ├── ElementAssignments.tsx  # Data element assignments
│   │   │   ├── List.tsx            # Data list view
│   │   │   └── TaskAssignment.tsx  # Task assignment for data collection
│   │   │
│   │   ├── Meter Management/
│   │   │   ├── MeterManagement.tsx # Meter CRUD operations
│   │   │   ├── Meter.tsx           # Individual meter details
│   │   │   └── SiteManagement.tsx  # Multi-site management
│   │   │
│   │   ├── User Management/
│   │   │   ├── UserManagement.tsx  # User CRUD (Super User, Admin only)
│   │   │   ├── InviteUser.tsx      # User invitation with magic link
│   │   │   └── RoleManagement.tsx  # Role assignment interface
│   │   │
│   │   ├── Settings/
│   │   │   ├── CompanySettings.tsx # Company profile settings
│   │   │   ├── AccountSettings.tsx # User account settings
│   │   │   └── NotificationSettings.tsx  # Notification preferences
│   │   │
│   │   ├── Admin/
│   │   │   ├── DeveloperAdmin.tsx  # Developer admin panel (PLATFORM DEV ONLY)
│   │   │   ├── AdminPanel.tsx      # Admin panel (company-level)
│   │   │   └── SystemHealth.tsx    # System health monitoring
│   │   │
│   │   ├── Events/
│   │   │   └── EventTasks.tsx      # Event-based task management
│   │   │
│   │   └── Misc/
│   │       ├── Home.tsx            # Landing page
│   │       ├── Rame.tsx            # Additional page component
│   │       └── NotFound.tsx        # 404 page
│   │
│   ├── components/            # Reusable components
│   │   ├── ui/                # Basic UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Tooltip.tsx
│   │   │   └── ProgressBar.tsx
│   │   │
│   │   ├── layout/            # Layout components
│   │   │   ├── Navbar.tsx         # Top navigation bar
│   │   │   ├── TopNavbar.tsx      # Alternative top navbar
│   │   │   ├── Sidebar.tsx        # Side navigation menu
│   │   │   ├── Footer.tsx         # Page footer
│   │   │   └── Layout.tsx         # Main layout wrapper
│   │   │
│   │   ├── forms/             # Form components
│   │   │   ├── MultiStepForm.tsx  # Multi-step wizard form
│   │   │   ├── FileUpload.tsx     # File upload with drag-drop
│   │   │   ├── FormDataEntry.tsx  # Data entry form component
│   │   │   ├── FormField.tsx      # Individual form field
│   │   │   └── FormValidation.tsx # Form validation utilities
│   │   │
│   │   ├── feedback/          # User feedback components
│   │   │   ├── Notification.tsx   # Toast notifications
│   │   │   ├── Alert.tsx          # Alert banners
│   │   │   ├── LoadingSpinner.tsx # Loading indicator
│   │   │   └── ErrorBoundary.tsx  # Error boundary component
│   │   │
│   │   ├── data/              # Data display components
│   │   │   ├── DataTable.tsx      # Sortable/filterable table
│   │   │   ├── DataCard.tsx       # Data display card
│   │   │   ├── ProgressChart.tsx  # Progress visualization
│   │   │   ├── MetricCard.tsx     # KPI metric card
│   │   │   └── Calendar.tsx       # Calendar view for data
│   │   │
│   │   ├── navigation/       # Navigation components
│   │   │   ├── Breadcrumbs.tsx    # Breadcrumb navigation
│   │   │   ├── TabNav.tsx         # Tab navigation
│   │   │   └── Pagination.tsx     # Pagination controls
│   │   │
│   │   └── auth/             # Authentication components
│   │       ├── ProtectedRoute.tsx # Route protection wrapper
│   │       ├── RequireAuth.tsx    # Authentication requirement
│   │       └── PermissionGate.tsx # Permission-based access
│   │
│   ├── hooks/                 # Custom hooks
│   │   ├── useAuth.ts              # Authentication state and methods
│   │   ├── useCompany.ts           # Company data and operations
│   │   ├── usePermissions.ts       # Permission checking
│   │   ├── useApi.ts               # API request wrapper
│   │   ├── usePagination.ts        # Pagination logic
│   │   ├── useDebounce.ts          # Debounce utility
│   │   ├── useLocalStorage.ts      # Local storage wrapper
│   │   ├── useFileUpload.ts        # File upload handling
│   │   ├── useNotification.ts      # Notification management
│   │   └── useChartData.ts         # Chart data preparation
│   │
│   ├── stores/                # Zustand stores
│   │   ├── authStore.ts            # Authentication state
│   │   ├── companyStore.ts         # Company state
│   │   ├── userStore.ts            # User state
│   │   ├── meterStore.ts           # Meter state
│   │   ├── dataStore.ts            # Data submission state
│   │   ├── frameworkStore.ts       # Framework state
│   │   └── uiStore.ts              # UI state (modals, sidebars)
│   │
│   ├── services/              # API services
│   │   ├── api.ts                  # Axios instance configuration
│   │   ├── authService.ts          # Authentication API
│   │   ├── userService.ts          # User management API
│   │   ├── companyService.ts       # Company API
│   │   ├── frameworkService.ts     # Framework API
│   │   ├── profilingService.ts     # Profiling API
│   │   ├── meterService.ts         # Meter API
│   │   ├── submissionService.ts    # Data submission API
│   │   ├── dashboardService.ts     # Dashboard API
│   │   ├── reportService.ts        # Report generation API
│   │   ├── uploadService.ts        # File upload API
│   │   ├── emailService.ts         # Email service API
│   │   └── notificationService.ts  # Notification API
│   │
│   ├── types/                 # TypeScript types
│   │   ├── user.ts                 # User types
│   │   ├── company.ts              # Company types
│   │   ├── framework.ts            # Framework types
│   │   ├── dataElement.ts          # Data element types
│   │   ├── submission.ts           # Data submission types
│   │   ├── meter.ts                # Meter types
│   │   ├── dashboard.ts            # Dashboard types
│   │   ├── permissions.ts          # Permission types
│   │   ├── api.ts                  # API response types
│   │   └── common.ts               # Common types
│   │
│   ├── utils/                 # Utilities
│   │   ├── validators.ts           # Form validators
│   │   ├── formatters.ts           # Data formatters (date, currency)
│   │   ├── constants.ts            # App constants
│   │   ├── helpers.ts              # Helper functions
│   │   ├── validators.ts           # Validation functions
│   │   ├── converters.ts           # Data conversion utilities
│   │   └── storage.ts              # Storage utilities
│   │
│   ├── styles/                # Global styles
│   │   ├── index.css              # Global CSS
│   │   ├── variables.css          # CSS variables (colors, spacing)
│   │   ├── tailwind.css           # Tailwind imports
│   │   └── animations.css         # CSS animations
│   │
│   └── assets/                # Static assets
│       ├── images/                # Image files
│       ├── icons/                 # Icon files
│       └── fonts/                 # Font files
│
├── public/
│   ├── index.html
│   ├── favicon.ico
│   ├── manifest.json           # PWA manifest
│   └── robots.txt
│
├── index.html
├── vite.config.ts              # Vite configuration
├── tsconfig.json               # TypeScript configuration
├── tailwind.config.js          # Tailwind configuration
├── package.json                # Dependencies and scripts
└── README.md
```

**Key Implementation Details:**

1. **Authentication Flow:**
```typescript
// stores/authStore.ts
interface AuthState {
  user: User | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

// hooks/useAuth.ts
export function useAuth() {
  const { user, accessToken, login, logout } = useAuthStore();

  useEffect(() => {
    // Auto-refresh token
    const interval = setInterval(refreshToken, 14 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { user, accessToken, login, logout };
}
```

2. **API Integration with React Query:**
```typescript
// services/dashboardService.ts
export const dashboardService = {
  getProgress: (companyId: number, year: number, month: number) =>
    api.get(`/api/companies/${companyId}/dashboard/progress?year=${year}&month=${month}`),
};

// pages/Dashboard.tsx
const { data: progress, isLoading } = useQuery({
  queryKey: ['dashboard', companyId, year, month],
  queryFn: () => dashboardService.getProgress(companyId, year, month),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

3. **Form Handling:**
```typescript
// pages/DataCollection.tsx
const { control, handleSubmit } = useForm({
  defaultValues: {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  },
});

const onSubmit = async (data) => {
  await submissionService.submitData(companyId, data);
  queryClient.invalidateQueries(['dashboard', companyId]);
};
```

---

## 🔐 SECURITY REQUIREMENTS

### Backend Security
1. **Input Validation:** All API inputs validated with Pydantic schemas
2. **SQL Injection Prevention:** Use SQLAlchemy parameterized queries
3. **XSS Prevention:** Sanitize all user-generated content
4. **CORS:** Restrict to specific origins (FRONTEND_URL env variable)
5. **Rate Limiting:** 100 requests/minute per IP, 10 requests/minute for auth endpoints
6. **Password Requirements:** Min 8 chars, uppercase, lowercase, number, special char
7. **JWT Expiry:** Access tokens 15 min, refresh tokens 7 days
8. **File Upload Validation:** Max 5MB, allowed types: PDF, JPG, PNG, DOCX
9. **Secrets Management:** Use environment variables, never hardcode
10. **HTTPS Only:** Production must use TLS

### Frontend Security
1. **XSS Protection:** React auto-escapes, but validate all inputs
2. **CSRF Protection:** Include CSRF token in state-changing requests
3. **Secure Storage:** Never store tokens in localStorage, use httpOnly cookies
4. **Content Security Policy:** Restrict script sources

---

## 🚀 DEPLOYMENT INSTRUCTIONS

### Backend Deployment (Render.com)
```yaml
# render.yaml
services:
  - type: web
    name: esg-portal-api
    runtime: python
    buildCommand: |
      pip install --no-cache-dir -r requirements.txt
      alembic upgrade head
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: esg-portal-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          type: redis
          name: esg-portal-redis
          property: connectionString
      - key: SECRET_KEY
        generateValue: true
      - key: AWS_ACCESS_KEY_ID
        sync: false
      - key: AWS_SECRET_ACCESS_KEY
        sync: false
```

### Frontend Deployment (Vercel)
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "env": {
    "VITE_API_URL": "@backend-api-url"
  }
}
```

---

## 📊 SUCCESS METRICS

1. **Performance:**
   - API response time < 200ms (p95)
   - Dashboard load time < 1s
   - Support 1000+ concurrent users

2. **Code Quality:**
   - 90%+ test coverage
   - Zero security vulnerabilities
   - No TypeScript/Pydantic errors

3. **User Experience:**
   - Onboarding time < 10 minutes
   - Data entry time < 5 minutes/month
   - Zero data loss incidents

---

## ✅ CHECKLIST FOR DEVELOPER

Use this checklist to ensure nothing is missed:

### Core Features
- [ ] User registration with email verification
- [ ] JWT authentication (access + refresh tokens)
- [ ] Company onboarding with framework assignment
- [ ] Profiling wizard with dynamic questions
- [ ] Personalized checklist generation
- [ ] Meter management (CRUD + auto-creation)
- [ ] Monthly data collection interface
- [ ] Evidence file upload to S3
- [ ] Dashboard with real-time progress
- [ ] Admin panel with audit logs

### Technical Requirements
- [ ] FastAPI backend with async/await
- [ ] React + TypeScript frontend
- [ ] PostgreSQL database with proper indexes
- [ ] Redis caching for dashboard
- [ ] Celery for background tasks
- [ ] AWS S3 for file storage
- [ ] Structured logging (NO print statements)
- [ ] Comprehensive error handling
- [ ] Input validation on all endpoints
- [ ] Rate limiting on API
- [ ] Database migrations (Alembic)
- [ ] API documentation (OpenAPI/Swagger)

### Security
- [ ] Password hashing with bcrypt
- [ ] JWT with short expiry
- [ ] HTTPS-only in production
- [ ] CORS restrictions
- [ ] File upload validation
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Secure secret management

### Testing
- [ ] Unit tests for all services
- [ ] Integration tests for API endpoints
- [ ] E2E tests for critical flows
- [ ] Load testing (1000 concurrent users)

### Deployment
- [ ] CI/CD pipeline
- [ ] Environment variable management
- [ ] Database backup strategy
- [ ] Monitoring & alerting
- [ ] Error tracking (Sentry)

---

## 🎨 UI/UX GUIDELINES

**Design Principles:**
1. **Clean & Professional**: Enterprise-grade UI suitable for UAE businesses
2. **Mobile Responsive**: 60% of users will access via mobile
3. **Accessibility**: WCAG 2.1 AA compliant
4. **Language**: English primary, Arabic secondary (expandable)
5. **Color Scheme**: Green/Blue (environmental theme)

**Key Screens:**
1. **Dashboard**: High-level metrics, quick actions, progress charts
2. **Data Collection**: Spreadsheet-like interface, bulk edit, file drag-drop
3. **Profiling Wizard**: Progress indicator, clear questions, preview results
4. **Reports**: Export options, date range picker, visual summaries

---

## 📚 REFERENCE IMPLEMENTATION SNIPPETS

### Service Layer Example (FastAPI)
```python
# services/framework_service.py
class FrameworkService:
    @staticmethod
    async def assign_mandatory_frameworks(
        company: Company,
        db: AsyncSession
    ) -> List[Framework]:
        """Auto-assign frameworks based on company profile"""
        frameworks = []

        # Core ESG - always mandatory
        esg_framework = await framework_service.get_by_code("ESG", db)
        frameworks.append(esg_framework)

        # DST - Dubai + Hospitality only
        if company.emirate == "dubai" and company.sector == "hospitality":
            dst_framework = await framework_service.get_by_code("DST", db)
            frameworks.append(dst_framework)

        # Save assignments
        for framework in frameworks:
            await company_framework_service.create(
                company_id=company.id,
                framework_id=framework.id,
                is_auto_assigned=True
            )

        return frameworks
```

### API Endpoint Example (FastAPI)
```python
# api/companies.py
@router.post("/{company_id}/meters/", response_model=MeterResponse)
async def create_meter(
    company_id: int,
    meter_data: MeterCreate,
    current_user: User = Depends(get_current_user),
    company: Company = Depends(get_company_access),
    db: AsyncSession = Depends(get_db)
):
    """Create a new meter for the company"""
    # Validate data element exists
    data_element = await data_element_service.get(meter_data.data_element_id, db)
    if not data_element:
        raise HTTPException(404, "Data element not found")

    # Create meter
    meter = await meter_service.create(
        company_id=company_id,
        **meter_data.dict(),
        db=db
    )

    # Log audit trail
    await audit_service.log_action(
        user_id=current_user.id,
        company_id=company_id,
        action="create",
        entity_type="meter",
        entity_id=meter.id,
        db=db
    )

    return meter
```

### Frontend Component Example (React + TypeScript)
```typescript
// components/DataCollectionForm.tsx
interface DataCollectionFormProps {
  companyId: number;
  year: number;
  month: number;
}

export function DataCollectionForm({ companyId, year, month }: DataCollectionFormProps) {
  const { control, handleSubmit } = useForm();
  const { mutate: submitData, isPending } = useMutation({
    mutationFn: (data: SubmissionCreate[]) =>
      submissionService.submitData(companyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard', companyId]);
      toast.success('Data submitted successfully');
    },
  });

  const { data: checklist } = useQuery({
    queryKey: ['checklist', companyId, year, month],
    queryFn: () => checklistService.getMonthlyChecklist(companyId, year, month),
  });

  return (
    <form onSubmit={handleSubmit(data => submitData(data))}>
      {checklist?.map(item => (
        <DataElementInput
          key={item.data_element_id}
          element={item}
          control={control}
        />
      ))}
      <Button type="submit" loading={isPending}>
        Submit Data
      </Button>
    </form>
  );
}
```

---

## 🎯 FINAL NOTES

This prompt provides a complete blueprint for building ESG Portal v2.0 from scratch. The key improvements over the Django version are:

1. **Modern Tech Stack**: FastAPI (async) vs Django (sync), Vite vs CRA
2. **Better Performance**: Redis caching, database indexes, optimized queries
3. **Enhanced Security**: JWT auth, rate limiting, input validation
4. **Improved Scalability**: S3 storage, Celery tasks, proper caching
5. **Type Safety**: TypeScript + Pydantic prevent entire classes of bugs
6. **Better Developer Experience**: Hot reload, auto-generated API docs, structured logging

**Estimated Development Time**: 6-8 weeks for a team of 2-3 developers

**Priority Order:**
1. Week 1-2: Authentication, User Management, Company Onboarding
2. Week 3-4: Profiling Wizard, Checklist Generation, Meter Management
3. Week 5-6: Data Collection System, Dashboard
4. Week 7-8: Admin Panel, Testing, Deployment, Polish

**Success Criteria:**
- Zero security vulnerabilities
- 90%+ test coverage
- < 200ms API response time (p95)
- Support 1000+ concurrent users
- Complete audit trail
- Multi-language support (English + Arabic)

---

**Start Building Now!** 🚀
