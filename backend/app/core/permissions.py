import os
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

class Permission(str, Enum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"

ROLE_PERMISSIONS = {
    Role.SUPER_USER: {
        "users": {Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE},
        "companies": {Permission.READ, Permission.UPDATE},
        "frameworks": {Permission.READ, Permission.UPDATE},
        "meters": {Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE},
        "data_submissions": {Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE},
        "dashboard": {Permission.READ}
    },
    Role.ADMIN: {
        "users": {Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE},
        "companies": {Permission.READ},
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

def has_permission(user_role: str, resource: str, permission: Permission) -> bool:
    try:
        role_enum = Role(user_role)
    except ValueError:
        return False
    role_perms = ROLE_PERMISSIONS.get(role_enum, {})
    resource_perms = role_perms.get(resource, set())
    return permission in resource_perms

def can_manage_role(manager_role: str, target_role: str) -> bool:
    try:
        manager_enum = Role(manager_role)
        target_enum = Role(target_role)
    except ValueError:
        return False
    manageable_roles = ROLE_HIERARCHY.get(manager_enum, [])
    return target_enum in manageable_roles
