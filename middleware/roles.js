// middleware/roles.js
/**
 * Enterprise Role-Based Access Control (RBAC) Middleware
 * Verifies if the authenticated user possesses the required role(s) to access a route.
 * Super Admin and Admin roles automatically bypass role restrictions.
 * 
 * @param {...(string|string[])} allowedRoles - Allowed roles as arguments or arrays
 * @returns {Function} Express middleware function
 */
const verifyRole = (...allowedRoles) => {
  // 🔥 Flatten roles to safely handle both spread args and array inputs (e.g., verifyRole('admin') or verifyRole(['admin']))
  const flattenedRoles = allowedRoles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized access. Authentication required.' 
      });
    }

    // 🔥 Pro Enterprise Feature: Super Admin or Admin automatically bypasses explicit role checks
    if (req.user.role === 'super_admin' || req.user.role === 'admin') {
      return next();
    }

    // Check if user role matches any allowed enterprise roles
    if (!flattenedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Access forbidden. Role [${req.user.role || 'unknown'}] does not have required permissions.` 
      });
    }

    next();
  };
};

// 🔥 Add robust aliases for maximum compatibility across different modules
verifyRole.verifyRole = verifyRole;
verifyRole.requireRole = verifyRole;
verifyRole.restrictTo = verifyRole;

module.exports = verifyRole;