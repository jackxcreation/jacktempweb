// middleware/rbacMiddleware.js

// 🔥 Define Role-Based Permissions Map (OWASP Least Privilege Design)
const ROLE_PERMISSIONS = {
  admin: [
    'users:all',
    'settings:all',
    'finance:all',
    'catalog:all',
    'orders:all',
    'tickets:all',
    'warehouse:all'
  ],
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

// 🔥 Dynamic Permission Checker Middleware
const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    try {
      const user = req.user; // protect ya adminProtect middleware se aaya hua user

      if (!user || !user.role) {
        return res.status(403).json({ success: false, message: 'Access Denied: No role assigned.' });
      }

      // Admin ke paas sab kuch hai
      if (user.role === 'admin') {
        return next();
      }

      const userPermissions = ROLE_PERMISSIONS[user.role] || [];

      // Check if user has exact permission or wildcard 'all' for that module
      const [module, action] = requiredPermission.split(':');
      const hasAccess = userPermissions.includes(requiredPermission) || 
                        userPermissions.includes(`${module}:all`) ||
                        userPermissions.includes('all');

      if (!hasAccess) {
        console.warn(`🚨 SECURITY AUDIT: User ${user.email} with role '${user.role}' tried to access unauthorized action: ${requiredPermission}`);
        return res.status(403).json({ 
          success: false, 
          message: `Access Denied: Your role ('${user.role}') lacks permission for [${requiredPermission}].` 
        });
      }

      next();
    } catch (error) {
      console.error("RBAC Middleware Error:", error);
      res.status(500).json({ success: false, message: 'Internal Server Error during authorization.' });
    }
  };
};

module.exports = { checkPermission };