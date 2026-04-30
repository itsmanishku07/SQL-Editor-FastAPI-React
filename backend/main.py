from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from database import get_db
import time
import base64

app = FastAPI(title="Postgres SQL Query Tool")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    query: str
    schema_name: Optional[str] = None

class QueryResponse(BaseModel):
    columns: List[str]
    rows: List[Dict[str, Any]]
    error: Optional[str] = None
    execution_time_ms: Optional[float] = None

class SettingsUpdate(BaseModel):
    db_url: str

@app.get("/")
def read_root():
    return {"message": "Postgres Query API is running"}

@app.get("/settings/db-url")
def get_db_url():
    from database import DATABASE_URL
    return {"db_url": DATABASE_URL}

@app.post("/settings/db-url")
def update_db_url_endpoint(settings: SettingsUpdate):
    from database import update_db_url
    try:
        from sqlalchemy import create_engine
        temp_engine = create_engine(settings.db_url)
        with temp_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            
        update_db_url(settings.db_url)
        return {"success": True, "message": "Database connection updated successfully."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to connect: {str(e)}")

@app.get("/schemas")
def get_schemas(db: Session = Depends(get_db)):
    try:
        query = text("""
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name NOT IN ('information_schema', 'pg_catalog') 
              AND schema_name NOT LIKE 'pg_toast%'
            ORDER BY schema_name;
        """)
        result = db.execute(query)
        schemas = [row[0] for row in result]
        return {"schemas": schemas}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tables")
def get_tables(schema: str = "public", db: Session = Depends(get_db)):
    try:
        query = text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = :schema 
            ORDER BY table_name;
        """)
        result = db.execute(query, {"schema": schema})
        tables = [row[0] for row in result]
        return {"tables": tables}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/schema-details")
def get_schema_details(schema: str = "public", db: Session = Depends(get_db)):
    try:
        query = text("""
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = :schema
            ORDER BY table_name, ordinal_position;
        """)
        result = db.execute(query, {"schema": schema})
        
        schema_dict = {}
        for row in result:
            t_name = row[0]
            c_name = row[1]
            if t_name not in schema_dict:
                schema_dict[t_name] = []
            schema_dict[t_name].append(c_name)
            
        return {"schema_details": schema_dict}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/execute", response_model=QueryResponse)
def execute_query(request: QueryRequest, db: Session = Depends(get_db)):
    start_time = time.time()
    try:
        if request.schema_name:
            db.execute(text(f'SET search_path TO "{request.schema_name}", public'))

        query = text(request.query)
        result = db.execute(query)
        db.commit() 
        
        columns = []
        rows = []
        if result.returns_rows:
            columns = list(result.keys())
            for row in result:
                row_dict = {}
                for col, val in zip(columns, row):
                    row_dict[col] = str(val) if val is not None else None
                rows.append(row_dict)
        
        execution_time = (time.time() - start_time) * 1000
        return {"columns": columns, "rows": rows, "error": None, "execution_time_ms": round(execution_time, 2)}
    except Exception as e:
        db.rollback()
        return {"columns": [], "rows": [], "error": str(e), "execution_time_ms": None}


class SaveFileRequest(BaseModel):
    filename: str
    content_b64: str 

def ensure_storage_schema(db: Session):
    """Auto-create the sql_pro_storage schema and saved_queries table if they don't exist."""
    db.execute(text("CREATE SCHEMA IF NOT EXISTS sql_pro_storage"))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS sql_pro_storage.saved_queries (
            id         SERIAL PRIMARY KEY,
            filename   VARCHAR(255) NOT NULL,
            content    TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.commit()

@app.post("/files/save")
def save_file(request: SaveFileRequest, db: Session = Depends(get_db)):
    try:
        ensure_storage_schema(db)
        filename = request.filename if request.filename.endswith('.sql') else request.filename + '.sql'
        base64.b64decode(request.content_b64)
        db.execute(
            text("INSERT INTO sql_pro_storage.saved_queries (filename, content) VALUES (:filename, :content)"),
            {"filename": filename, "content": request.content_b64}
        )
        db.commit()
        return {"success": True, "message": f"'{filename}' saved successfully."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/files")
def list_files(db: Session = Depends(get_db)):
    try:
        ensure_storage_schema(db)
        result = db.execute(text("""
            SELECT id, filename, created_at
            FROM sql_pro_storage.saved_queries
            ORDER BY created_at DESC
        """))
        files = [
            {"id": row[0], "filename": row[1], "created_at": str(row[2])}
            for row in result
        ]
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/files/{file_id}")
def get_file(file_id: int, db: Session = Depends(get_db)):
    try:
        result = db.execute(
            text("SELECT id, filename, content, created_at FROM sql_pro_storage.saved_queries WHERE id = :id"),
            {"id": file_id}
        )
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="File not found")
        return {"id": row[0], "filename": row[1], "content_b64": row[2], "created_at": str(row[3])}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/files/{file_id}")
def delete_file(file_id: int, db: Session = Depends(get_db)):
    try:
        result = db.execute(
            text("DELETE FROM sql_pro_storage.saved_queries WHERE id = :id RETURNING id"),
            {"id": file_id}
        )
        db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="File not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
