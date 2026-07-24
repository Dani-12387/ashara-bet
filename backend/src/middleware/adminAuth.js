module.exports = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Not authenticated' 
    });
  }
  
  if (req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ 
      success: false, 
      message: 'Access denied. Admin only.' 
    });
  }
};