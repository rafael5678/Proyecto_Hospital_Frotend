# Sistema de Ruteo y Protección de Rutas

Las rutas están protegidas mediante AuthGuard y RoleGuard. Si un usuario sin sesión intenta acceder, es redirigido a /login. Si un paciente intenta entrar a /admin, es bloqueado por falta de permisos.
