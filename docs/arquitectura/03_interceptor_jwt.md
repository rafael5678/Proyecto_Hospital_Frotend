# Interceptor HTTP para Tokens JWT

JwtInterceptor intercepta todas las peticiones salientes e inyecta el header Authorization: Bearer <token>. Si recibe un código 401 Unauthorized, redirige al login.
