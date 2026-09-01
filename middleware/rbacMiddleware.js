// middleware/rbacMiddleware.js

// 🔥 Expanded Enterprise Role-Based Permissions Map (Zero-Trust & Least Privilege Design)
const ROLE_PERMISSIONS = {
  super_admin: [
    'all'
  ],
  admin: [
    'users:all',
    'settings:all',
    'finance:all',
    'catalog:all',
    'orders:all',
    'tickets:all',
    'warehouse:all',
    'products:all',
    'inventory:all',
    'customers:all'
  ],
  operations_manager: [
    'orders:view', 'orders:edit', 'orders:cancel', 'orders:refund', 'orders:ship', 'orders:all',
    'warehouse:all',
    'inventory:view', 'inventory:adjust', 'inventory:transfer', 'inventory:all',
    'tickets:read'
  ],
  catalog_manager: [
    'products:view', 'products:create', 'products:edit', 'products:publish', 'products:all',
    'catalog:all'
  ],
  warehouse_manager: [
    'inventory:view', 'inventory:adjust', 'inventory:transfer', 'inventory:all',
    'warehouse:all',
    'orders:view', 'orders:ship'
  ],
  customer_support: [
    'tickets:all',
    'orders:view', 'orders:edit',
    'customers:view', 'customers:contact'
  ],
  finance_manager: [
    'finance:view', 'finance:refund', 'finance:payout', 'finance:all',
    'orders:view'
  ],
  marketing_manager: [
    'products:view',
    'customers:view', 'customers:export'
  ],
  content_manager: [
    'products:view', 'products:create', 'products:edit', 'products:publish',
    'catalog:all'
  ],
  analyst: [
    'orders:view',
    'products:view',
    'inventory:view',
    'finance:view',
    'customers:view'
  ],
  read_only_auditor: [
    'orders:view',
    'products:view',
    'inventory:view',
    'finance:view',
    'customers:view',
    'tickets:read',
    'settings:read'
  ],
  // 🔥 Legacy Roles Maintained for 100% Backward Compatibility
  manager: [
    'orders:all',
    'warehouse:all',
    'tickets:read'
  ],
  catalog: [
    'products:all',
    'inventory:all'
  ],
  support: [
    'tickets:all',
    'orders:read'
  ],
  customer: [
    'profile:self'
  ]
};

// 🔥 Dynamic Zero-Trust Permission Checker Middleware
const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    try {
      const user = req.user; // protect middleware se attach hua user object

      if (!user || !user.role) {
        console.warn(`🚨 SECURITY AUDIT: Unauthorized access attempt without role from IP: ${req.ip}`);
        return res.status(403).json({ success: false, message: 'Access Denied: No role assigned or session invalid.' });
      }

      // Super Admin or Admin with global wildcard bypasses all checks
      if (user.role === 'super_admin' || user.role === 'admin') {
        return next();
      }

      const userPermissions = ROLE_PERMISSIONS[user.role] || [];

      // Parse module and action (e.g., 'orders:ship' -> module: 'orders', action: 'ship')
      const [module, action] = requiredPermission.split(':');

      // Check if user has exact permission, module wildcard ('module:all'), or global wildcard ('all')
      const hasAccess = userPermissions.includes(requiredPermission) || 
                        userPermissions.includes(`${module}:all`) ||
                        userPermissions.includes('all');

      if (!hasAccess) {
        console.warn(`🚨 SECURITY AUDIT: User [${user.email || user._id}] with role '${user.role}' tried to access unauthorized resource: [${requiredPermission}] at ${req.originalUrl}`);
        return res.status(403).json({ 
          success: false, 
          message: `Access Denied: Your role ('${user.role}') lacks granular permission for [${requiredPermission}].` 
        });
      }

      next();
    } catch (error) {
      console.error("RBAC Middleware Error:", error);
      res.status(500).json({ success: false, message: 'Internal Server Error during authorization enforcement.' });
    }
  };
};

module.exports = { checkPermission, ROLE_PERMISSIONS };