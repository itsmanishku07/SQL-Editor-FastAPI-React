from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
import os
from dotenv import load_dotenv, set_key
from functools import lru_cache

env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/postgres")

# AI Settings
DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "")
DATABRICKS_TOKEN = os.getenv("DATABRICKS_TOKEN", "")
DATABRICKS_MODEL_ENDPOINT = os.getenv("DATABRICKS_MODEL_ENDPOINT", "")

# Cache engines to avoid re-creating them on every request
@lru_cache(maxsize=10)
def get_engine(url: str):
    return create_engine(url, pool_pre_ping=True, pool_recycle=3600)

def get_db(db_url_override: str = None):
    url = db_url_override or DATABASE_URL
    if not url:
        raise Exception("Database URL not configured.")
    
    engine = get_engine(url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def update_db_url(new_url: str):
    global DATABASE_URL
    DATABASE_URL = new_url
    try:
        set_key(env_path, "DATABASE_URL", new_url)
    except: pass

def update_ai_settings(host: str, token: str, model: str):
    global DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_MODEL_ENDPOINT
    DATABRICKS_HOST = host
    DATABRICKS_TOKEN = token
    DATABRICKS_MODEL_ENDPOINT = model
    try:
        set_key(env_path, "DATABRICKS_HOST", host)
        set_key(env_path, "DATABRICKS_TOKEN", token)
        set_key(env_path, "DATABRICKS_MODEL_ENDPOINT", model)
    except: pass

def get_ai_settings():
    return {
        "host": DATABRICKS_HOST,
        "token": DATABRICKS_TOKEN,
        "model": DATABRICKS_MODEL_ENDPOINT
    }
