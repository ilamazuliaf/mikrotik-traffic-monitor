import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import config
from app.database.database import init_db
from app.mikrotik.monitor import monitor_worker
from app.api.config_api import router as config_router
from app.api.status import router as status_router
from app.api.interfaces import router as interfaces_router
from app.api.traffic import router as traffic_router

# Setup Logging (PRD Section 23)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("mikrotik_monitor")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks
    logger.info("Initializing MikroTik Traffic Monitor application...")
    config.validate_config()
    init_db()
    monitor_worker.start()
    yield
    # Shutdown tasks
    logger.info("Shutting down MikroTik Traffic Monitor application...")
    monitor_worker.stop()

app = FastAPI(
    title="MikroTik Traffic Monitor",
    version="1.1.0",
    description="Realtime & Historical interface traffic monitor for STB Ubuntu",
    lifespan=lifespan
)

BASE_DIR = Path(__file__).resolve().parent.parent

# Mount static files
static_dir = BASE_DIR / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Include API Routers
app.include_router(config_router, prefix="/api", tags=["Config"])
app.include_router(status_router, prefix="/api", tags=["Status"])
app.include_router(interfaces_router, prefix="/api", tags=["Interfaces"])
app.include_router(traffic_router, prefix="/api", tags=["Traffic"])

# Dashboard HTML Route
@app.get("/", response_class=FileResponse)
def read_root():
    template_file = BASE_DIR / "app" / "templates" / "index.html"
    if template_file.exists():
        return FileResponse(str(template_file))
    index_file = BASE_DIR / "index.html"
    return FileResponse(str(index_file))
