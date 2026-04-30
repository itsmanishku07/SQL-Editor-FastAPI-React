from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv, set_key

env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/postgres")

# AI Settings
DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "")
DATABRICKS_TOKEN = os.getenv("DATABRICKS_TOKEN", "")
DATABRICKS_MODEL_ENDPOINT = os.getenv("DATABRICKS_MODEL_ENDPOINT", "")

engine = None
SessionLocal = None

def init_db(db_url: str):
    global engine, SessionLocal, DATABASE_URL
    DATABASE_URL = db_url
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

init_db(DATABASE_URL)

def update_db_url(new_url: str):
    try:
        set_key(env_path, "DATABASE_URL", new_url)
    except: pass
    init_db(new_url)

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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
