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

class AiSettingsUpdate(BaseModel):
    host: str
    token: str
    model: str

class AiGenerateRequest(BaseModel):
    prompt: str

class AiDataRequest(BaseModel):
    schema_sql: str
    count: int = 10

class ChatRequest(BaseModel):
    message: str

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
@app.get("/settings/ai")
def get_ai_settings():
    from database import DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_MODEL_ENDPOINT
    return {
        "host": DATABRICKS_HOST,
        "token": DATABRICKS_TOKEN,
        "model": DATABRICKS_MODEL_ENDPOINT
    }

@app.post("/settings/ai")
def update_ai_settings_endpoint(settings: AiSettingsUpdate):
    from database import update_ai_settings
    update_ai_settings(settings.host, settings.token, settings.model)
    return {"success": True, "message": "AI settings updated successfully."}

@app.post("/ai/generate-schema")
def ai_generate_schema_endpoint(request: AiGenerateRequest):
    from ai_service import generate_schema_sql
    try:
        sql = generate_schema_sql(request.prompt)
        return {"sql": sql}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai/generate-data")
def ai_generate_data_endpoint(request: AiDataRequest):
    from ai_service import generate_data_sql
    try:
        sql = generate_data_sql(request.schema_sql, request.count)
        return {"sql": sql}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    error_msg = None
    row_count = 0
    execution_time = 0
    
    try:
        ensure_storage_schema(db)
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
            row_count = len(rows)
        
        execution_time = (time.time() - start_time) * 1000
        
        # Log to history
        db.execute(
            text("INSERT INTO sql_pro_storage.query_history (query, execution_time_ms, row_count, status) VALUES (:q, :t, :r, 'success')"),
            {"q": request.query, "t": round(execution_time, 2), "r": row_count}
        )
        db.commit()
        
        return {"columns": columns, "rows": rows, "error": None, "execution_time_ms": round(execution_time, 2)}
    except Exception as e:
        db.rollback()
        error_msg = str(e)
        execution_time = (time.time() - start_time) * 1000
        
        # Log error to history
        try:
            db.execute(
                text("INSERT INTO sql_pro_storage.query_history (query, execution_time_ms, status, error_message) VALUES (:q, :t, 'error', :e)"),
                {"q": request.query, "t": round(execution_time, 2), "e": error_msg}
            )
            db.commit()
        except: pass
        
        return {"columns": [], "rows": [], "error": error_msg, "execution_time_ms": None}


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
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS sql_pro_storage.chat_history (
            id         SERIAL PRIMARY KEY,
            role       VARCHAR(20) NOT NULL,
            content    TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS sql_pro_storage.query_history (
            id             SERIAL PRIMARY KEY,
            query          TEXT NOT NULL,
            execution_time_ms FLOAT,
            row_count      INTEGER,
            status         VARCHAR(20),
            error_message  TEXT,
            query_plan     JSONB,
            created_at     TIMESTAMPTZ DEFAULT NOW()
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


@app.get("/ai/chat/history")
def get_chat_history(db: Session = Depends(get_db)):
    try:
        ensure_storage_schema(db)
        result = db.execute(text("SELECT role, content FROM sql_pro_storage.chat_history ORDER BY id ASC"))
        history = [{"role": row[0], "content": row[1]} for row in result]
        return {"history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai/chat")
def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    from ai_service import chat_sql_expert
    try:
        ensure_storage_schema(db)
        result = db.execute(text("SELECT role, content FROM sql_pro_storage.chat_history ORDER BY id DESC LIMIT 10"))
        history = [{"role": row[0], "content": row[1]} for row in result]
        history.reverse()
        
        history.append({"role": "user", "content": request.message})
        
        db.execute(text("INSERT INTO sql_pro_storage.chat_history (role, content) VALUES ('user', :msg)"), {"msg": request.message})
        
        ai_response = chat_sql_expert(history)
        
        db.execute(text("INSERT INTO sql_pro_storage.chat_history (role, content) VALUES ('assistant', :msg)"), {"msg": ai_response})
        db.commit()
        
        return {"response": ai_response}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai/chat/clear")
def clear_chat_history(db: Session = Depends(get_db)):
    try:
        ensure_storage_schema(db)
        db.execute(text("DELETE FROM sql_pro_storage.chat_history"))
        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze")
def analyze_query(request: QueryRequest, db: Session = Depends(get_db)):
    try:
        ensure_storage_schema(db)
        if request.schema_name:
            db.execute(text(f'SET search_path TO "{request.schema_name}", public'))
            
        # Run EXPLAIN ANALYZE
        explain_query = text(f"EXPLAIN (ANALYZE, COSTS, VERBOSE, BUFFERS, FORMAT JSON) {request.query}")
        result = db.execute(explain_query)
        plan = result.fetchone()[0]
        
        # Save to history if it was a recent query (optional: link to existing history)
        # For now just return it
        return {"plan": plan}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/history")
def get_query_history(limit: int = 50, db: Session = Depends(get_db)):
    try:
        ensure_storage_schema(db)
        result = db.execute(text("""
            SELECT id, query, execution_time_ms, row_count, status, error_message, created_at 
            FROM sql_pro_storage.query_history 
            ORDER BY created_at DESC 
            LIMIT :limit
        """), {"limit": limit})
        
        history = []
        for row in result:
            history.append({
                "id": row[0],
                "query": row[1],
                "execution_time_ms": row[2],
                "row_count": row[3],
                "status": row[4],
                "error_message": row[5],
                "created_at": str(row[6])
            })
        return {"history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ChallengeRequest(BaseModel):
    table_names: List[str]
    difficulty: str
    schema_name: Optional[str] = "public"

class VerifyRequest(BaseModel):
    user_sql: str
    solution_sql: str
    schema_name: Optional[str] = "public"

@app.post("/ai/generate-challenge")
def generate_challenge_endpoint(request: ChallengeRequest, db: Session = Depends(get_db)):
    from ai_service import generate_sql_challenge
    try:
        # Fetch schemas and sample data for selected tables
        schema_details = {}
        for table in request.table_names:
            # Get columns
            query = text("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = :schema AND table_name = :table
                ORDER BY ordinal_position;
            """)
            result = db.execute(query, {"schema": request.schema_name, "table": table})
            cols = [f"{row[0]} ({row[1]})" for row in result]
            
            # Get sample rows (limit 3)
            try:
                sample_query = text(f'SELECT * FROM "{request.schema_name}"."{table}" LIMIT 3')
                sample_result = db.execute(sample_query)
                sample_rows = [list(row) for row in sample_result]
                # Convert non-serializable values to string for sample context
                sanitized_samples = []
                for row in sample_rows:
                    sanitized_samples.append([str(v) if not isinstance(v, (int, float, str, bool)) and v is not None else v for v in row])
            except:
                sanitized_samples = []
                
            schema_details[table] = {
                "columns": cols,
                "sample_data": sanitized_samples
            }
            
        challenge = generate_sql_challenge(schema_details, request.difficulty)
        
        # Execute solution_sql to get expected output
        try:
            if request.schema_name:
                db.execute(text(f'SET search_path TO "{request.schema_name}", public'))
            
            sol_result = db.execute(text(challenge['solution_sql']))
            sol_cols = list(sol_result.keys())
            sol_rows = []
            for row in sol_result:
                sanitized_row = []
                for val in row:
                    if isinstance(val, (float, int, str, bool)) or val is None:
                        sanitized_row.append(val)
                    else:
                        sanitized_row.append(str(val))
                sol_rows.append(sanitized_row)
            
            challenge['expected'] = {"columns": sol_cols, "rows": sol_rows}
        except Exception as e:
            # If solution fails (e.g. AI generated invalid SQL), we still return the challenge but without expected data
            challenge['expected'] = None
            challenge['error'] = f"Could not generate expected output: {str(e)}"
            
        return challenge
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/challenge/verify")
def verify_challenge_endpoint(request: VerifyRequest, db: Session = Depends(get_db)):
    try:
        # Set search path for the session
        if request.schema_name:
            db.execute(text(f'SET search_path TO "{request.schema_name}", public'))

        # 1. Run Solution SQL (The Ground Truth)
        try:
            sol_result = db.execute(text(request.solution_sql))
            sol_cols = list(sol_result.keys())
            sol_rows = []
            for row in sol_result:
                sanitized_row = []
                for val in row:
                    if isinstance(val, (float, int, str, bool)) or val is None:
                        sanitized_row.append(val)
                    else:
                        sanitized_row.append(str(val))
                sol_rows.append(sanitized_row)
        except Exception as sol_err:
            return {
                "is_correct": False, 
                "message": f"System error: The solution query is invalid. Please generate a new challenge. Error: {str(sol_err)}",
                "solution_sql": request.solution_sql
            }

        # 2. Run User SQL
        try:
            user_result = db.execute(text(request.user_sql))
            user_cols = list(user_result.keys())
            user_rows = []
            for row in user_result:
                sanitized_row = []
                for val in row:
                    if isinstance(val, (float, int, str, bool)) or val is None:
                        sanitized_row.append(val)
                    else:
                        sanitized_row.append(str(val))
                user_rows.append(sanitized_row)
        except Exception as user_err:
            return {
                "is_correct": False, 
                "message": f"Execution Error: {str(user_err)}",
                "expected": {"columns": sol_cols, "rows": sol_rows},
                "solution_sql": request.solution_sql
            }

        # 3. Comprehensive Comparison
        import json
        
        # Check column count
        if len(user_cols) != len(sol_cols):
            return {
                "is_correct": False, 
                "message": f"Wrong number of columns. Expected {len(sol_cols)}, got {len(user_cols)}.",
                "expected": {"columns": sol_cols, "rows": sol_rows},
                "solution_sql": request.solution_sql
            }

        # Check row count
        if len(user_rows) != len(sol_rows):
            return {
                "is_correct": False, 
                "message": f"Wrong number of rows. Expected {len(sol_rows)}, got {len(user_rows)}.",
                "expected": {"columns": sol_cols, "rows": sol_rows},
                "solution_sql": request.solution_sql
            }

        # Sort both for comparison (order agnostic)
        u_sorted = sorted([json.dumps(r, sort_keys=True) for r in user_rows])
        s_sorted = sorted([json.dumps(r, sort_keys=True) for r in sol_rows])
        
        if u_sorted == s_sorted:
            return {
                "is_correct": True, 
                "message": "Correct! Your query results match the expected output perfectly.",
                "expected": {"columns": sol_cols, "rows": sol_rows},
                "solution_sql": request.solution_sql
            }
        else:
            return {
                "is_correct": False, 
                "message": "Results mismatch. The data returned by your query doesn't match the expected records.",
                "expected": {"columns": sol_cols, "rows": sol_rows},
                "solution_sql": request.solution_sql
            }

    except Exception as e:
        db.rollback()
        return {"is_correct": False, "message": f"Verification failed: {str(e)}"}
