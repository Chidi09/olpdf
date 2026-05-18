import json
import sys
import uuid
import time
import logging
import os
from typing import Optional
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .limiter import limiter
from .core.auth import verify_jwt_token
from .core.security import hash_api_key
from .core.supabase_client import supabase
from .repositories.user_repo import ApiKeyRepository
from .routes import documents, books, ai, pdf, worker, templates, api_keys, account, webhooks, signatures, workspaces, forms, plugins, tenants, annotations, avatar, comments, ai_settings, auth, pdf_edits, telemetry, downloads, pdf_jobs, publications, v1, magic

class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": self.formatTime(record, self.datefmt),
            "name": record.name,
            "level": record.levelname,
            "message": record.getMessage(),
        }
        if hasattr(record, "request_id"):
            log_record["request_id"] = record.request_id
        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_record)

# Configure logging
logger = logging.getLogger("olpdf-api")
logger.setLevel(logging.INFO)

# Avoid adding multiple handlers in hot-reload scenarios
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)

MAX_REQUEST_BYTES = 10 * 1024 * 1024

REQUIRED_ENV_VARS = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_JWT_SECRET",
    "QSTASH_TOKEN",
    "QSTASH_CURRENT_SIGNING_KEY",
    "WORKER_SECRET",
    "GEMINI_API_KEY",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_ENDPOINT",
    "R2_BUCKET_NAME"
]

def validate_env():
    if os.environ.get("OLPDF_DEV_MODE") == "true" or "pytest" in sys.modules:
        return
    missing = [var for var in REQUIRED_ENV_VARS if not os.environ.get(var)]
    if missing:
        error_msg = f"Missing required environment variables: {', '.join(missing)}"
        logger.error(error_msg)
        raise RuntimeError(error_msg)
        
    # Check SMTP if configured
    smtp_host = os.environ.get("SMTP_HOST")
    if smtp_host:
        import smtplib
        port = int(os.environ.get("SMTP_PORT", 587))
        try:
            with smtplib.SMTP(smtp_host, port, timeout=5) as server:
                server.ehlo()
                logger.info(f"Successfully connected to SMTP server at {smtp_host}:{port}")
        except Exception as e:
            logger.warning(f"Failed to connect to SMTP server at {smtp_host}:{port} - {e}")


def create_app() -> FastAPI:
    # Validate env before starting
    validate_env()
    
    app = FastAPI(
        title="OLPDF API",
        description="Backend API for OLPDF - Open Lightweight PDF Editor",
        version="0.1.0"
    )

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    _raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
    if _raw_origins:
        _allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
    else:
        _allowed_origins = []

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-API-Key", "X-Request-ID"],
    )

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        # Swagger UI needs CDN assets — relax CSP only for /docs and /redoc
        if request.url.path.startswith(("/docs", "/redoc", "/openapi.json")):
            response.headers["Content-Security-Policy"] = (
                "default-src 'none'; "
                "script-src 'unsafe-inline' https://cdn.jsdelivr.net; "
                "style-src 'unsafe-inline' https://cdn.jsdelivr.net; "
                "img-src 'self' https://fastapi.tiangolo.com data:; "
                "connect-src 'self'; "
                "frame-ancestors 'none'"
            )
        else:
            response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        return response

    @app.middleware("http")
    async def add_request_id_and_logging(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        start_time = time.time()
        
        # Log request
        logger.info(f"Request: {request.method} {request.url.path}", extra={"request_id": request_id})
        
        response = await call_next(request)
        
        process_time = time.time() - start_time
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{process_time:.4f}s"
        
        # Log response
        logger.info(f"Response: {response.status_code} (took {process_time:.4f}s)", extra={"request_id": request_id})
        
        return response

    @app.middleware("http")
    async def guard_api_requests(request: Request, call_next):
        path = request.url.path
        if path.startswith("/api/"):
            # Enforce max payload size even when dev mode bypasses auth.
            content_length = request.headers.get("content-length")
            if content_length is not None:
                try:
                    size = int(content_length)
                except ValueError:
                    return JSONResponse(
                        status_code=400,
                        content={"error": "api_error", "message": "Invalid Content-Length header"}
                    )
                if size > MAX_REQUEST_BYTES:
                    return JSONResponse(
                        status_code=413,
                        content={"error": "api_error", "message": "Payload too large (max 10MB)"}
                    )

            if os.environ.get("OLPDF_DEV_MODE") == "true":
                return await call_next(request)

            # Worker routes use QStash signature instead of JWT/API Key
            if not path.startswith("/api/worker/"):
                # Routes that accept X-Worker-Secret instead of JWT
                worker_secret_paths = ["/api/pdf-jobs/", "/api/downloads"]
                needs_worker_check = any(
                    path.startswith(ws_path) for ws_path in worker_secret_paths
                )
                if needs_worker_check:
                    worker_secret = request.headers.get("X-Worker-Secret", "")
                    env_secret = os.environ.get("WORKER_SECRET", "")
                    if worker_secret and env_secret and worker_secret == env_secret:
                        response = await call_next(request)
                        return response
                    return JSONResponse(
                        status_code=401,
                        content={"error": "api_error", "message": "Valid X-Worker-Secret required for this endpoint"},
                    )

                auth_header = request.headers.get("authorization", "")
                api_key_header = request.headers.get("x-api-key", "")

                authenticated = False
                
                # Try JWT
                if auth_header.startswith("Bearer "):
                    try:
                        verify_jwt_token(auth_header[7:])
                        authenticated = True
                    except HTTPException:
                        pass
                
                # Try API Key if not already authenticated via JWT
                if not authenticated and api_key_header:
                    key_hash = hash_api_key(api_key_header)
                    if ApiKeyRepository.get_by_hash(key_hash):
                        authenticated = True

                if not authenticated:
                    return JSONResponse(
                        status_code=401,
                        content={"error": "api_error", "message": "Authentication required (JWT or API Key)"}
                    )

        response = await call_next(request)
        return response

    # Global Exception Handlers
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": "api_error", "message": exc.detail, "detail": exc.detail},
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        request_id = request.headers.get("X-Request-ID", "unknown")
        logger.error(f"Unhandled exception: {str(exc)}", exc_info=exc, extra={"request_id": request_id})
        return JSONResponse(
            status_code=500,
            content={"error": "internal_server_error", "message": "An unexpected error occurred"},
        )

    # Health Check — probes DB so load balancers / uptime monitors get accurate signal
    @app.get("/health")
    async def health_check():
        checks: dict = {}

        # DB probe: cheapest possible query
        try:
            supabase.table("profiles").select("id").limit(1).execute()
            checks["db"] = "ok"
        except Exception as exc:
            logger.warning(f"Health check DB probe failed: {exc}")
            checks["db"] = "degraded"

        overall = "healthy" if all(v == "ok" for v in checks.values()) else "degraded"
        status_code = 200 if overall == "healthy" else 503
        return JSONResponse(
            status_code=status_code,
            content={"status": overall, "checks": checks},
        )

    # Include Routers
    app.include_router(documents.router)
    app.include_router(books.router)
    app.include_router(ai.router)
    app.include_router(pdf.router)
    app.include_router(worker.router)
    app.include_router(templates.router)
    app.include_router(api_keys.router)
    app.include_router(account.router)
    app.include_router(webhooks.router)
    app.include_router(signatures.router)
    app.include_router(workspaces.router)
    app.include_router(forms.router)
    app.include_router(annotations.router)
    app.include_router(comments.router)
    app.include_router(plugins.router)
    app.include_router(tenants.router)
    app.include_router(avatar.router)
    app.include_router(ai_settings.router)
    app.include_router(auth.router)
    app.include_router(pdf_edits.router)
    app.include_router(downloads.router)
    app.include_router(pdf_jobs.router)
    app.include_router(publications.router)
    app.include_router(telemetry.router)
    app.include_router(v1.router)
    app.include_router(magic.router)

    @app.on_event("startup")
    async def warm_redis():
        try:
            from .core.cache import get_redis
            r = await get_redis()
            if r:
                await r.ping()
                logger.info("Redis connected — caching enabled")
            else:
                logger.info("Redis not configured — caching disabled")
        except Exception as e:
            logger.warning("Redis unavailable — caching disabled: %s", e)

    @app.on_event("shutdown")
    async def close_redis():
        try:
            from .core.cache import get_redis
            r = await get_redis()
            if r:
                await r.aclose()
        except Exception:
            pass

    return app

app = create_app()
