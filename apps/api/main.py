import uuid
import time
import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from .auth_utils import verify_jwt_token
from .routes import documents, books, ai, pdf, worker, templates

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("olpdf-api")

MAX_REQUEST_BYTES = 10 * 1024 * 1024

def create_app() -> FastAPI:
    app = FastAPI(
        title="OLPDF API",
        description="Backend API for OLPDF - Open Lightweight PDF Editor",
        version="0.1.0"
    )

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
            # Worker routes use QStash signature instead of JWT
            if not path.startswith("/api/worker/"):
                auth_header = request.headers.get("authorization", "")
                if not auth_header.startswith("Bearer "):
                    return JSONResponse(
                        status_code=401,
                        content={"error": "api_error", "message": "Missing bearer token"}
                    )
                try:
                    verify_jwt_token(auth_header[7:])
                except HTTPException as e:
                    return JSONResponse(
                        status_code=e.status_code,
                        content={"error": "api_error", "message": e.detail}
                    )

            # Enforce max payload size
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

        response = await call_next(request)
        return response

    # Global Exception Handlers
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": "api_error", "message": exc.detail},
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=500,
            content={"error": "internal_server_error", "message": str(exc)},
        )

    # Health Check
    @app.get("/health")
    async def health_check():
        return {"status": "healthy"}

    # Include Routers
    app.include_router(documents.router)
    app.include_router(books.router)
    app.include_router(ai.router)
    app.include_router(pdf.router)
    app.include_router(worker.router)
    app.include_router(templates.router)

    return app

app = create_app()
