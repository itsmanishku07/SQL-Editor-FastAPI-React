from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv, set_key

env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/postgres")

engine = None
SessionLocal = None

def init_db(db_url: str):
    global engine, SessionLocal, DATABASE_URL
    DATABASE_URL = db_url
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

init_db(DATABASE_URL)

def update_db_url(new_url: str):
    set_key(env_path, "DATABASE_URL", new_url)
    init_db(new_url)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
