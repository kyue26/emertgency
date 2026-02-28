// 404 Not Found handler
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: [
      '/api/auth',
      '/api/events',
      '/api/professionals',
      '/api/groups',
      '/api/camps',
      '/api/injured-persons',
      '/api/tasks',
      '/api/hospitals',
    ],
  });
};
