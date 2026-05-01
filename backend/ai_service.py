import requests
import json
import re
from database import DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_MODEL_ENDPOINT

def get_ai_headers():
    return {
        "Authorization": f"Bearer {DATABRICKS_TOKEN}",
        "Content-Type": "application/json"
    }

def clean_sql(sql_text):
    # Remove markdown code blocks if present
    sql_text = re.sub(r'```sql\s*', '', sql_text)
    sql_text = re.sub(r'```\s*', '', sql_text)
    return sql_text.strip()

def generate_schema_sql(prompt):
    if not DATABRICKS_HOST or not DATABRICKS_TOKEN or not DATABRICKS_MODEL_ENDPOINT:
        raise Exception("Databricks AI settings are not configured. Please go to Settings.")

    url = f"{DATABRICKS_HOST}/serving-endpoints/{DATABRICKS_MODEL_ENDPOINT}/invocations"
    
    system_prompt = """You are an expert PostgreSQL DBA. 
Your task is to generate valid PostgreSQL CREATE TABLE statements based on the user's requirements.
ONLY return the SQL code. Do not include any explanations, comments, or markdown formatting.
Ensure the SQL uses standard PostgreSQL types (SERIAL, VARCHAR, TIMESTAMP, etc.)."""

    payload = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Create PostgreSQL tables for: {prompt}"}
        ],
        "temperature": 0.1,
        "max_tokens": 1000
    }

    response = requests.post(url, headers=get_ai_headers(), json=payload)
    if response.status_code != 200:
        raise Exception(f"Databricks API Error ({response.status_code}): {response.text}")

    result = response.json()
    sql = result['choices'][0]['message']['content']
    return clean_sql(sql)

def generate_data_sql(schema_sql, count):
    if not DATABRICKS_HOST or not DATABRICKS_TOKEN or not DATABRICKS_MODEL_ENDPOINT:
        raise Exception("Databricks AI settings are not configured.")

    url = f"{DATABRICKS_HOST}/serving-endpoints/{DATABRICKS_MODEL_ENDPOINT}/invocations"
    
    system_prompt = f"""You are an expert data engineer. 
Your task is to generate valid PostgreSQL INSERT statements to populate the following schema with {count} rows of realistic synthetic data.
ONLY return the SQL INSERT statements. Do not include explanations or markdown.
Schema:
{schema_sql}"""

    payload = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Generate {count} rows of realistic INSERT statements for the provided schema."}
        ],
        "temperature": 0.7,
        "max_tokens": 2000
    }

    response = requests.post(url, headers=get_ai_headers(), json=payload)
    if response.status_code != 200:
        raise Exception(f"Databricks API Error ({response.status_code}): {response.text}")

    result = response.json()
    sql = result['choices'][0]['message']['content']
    return clean_sql(sql)

def chat_sql_expert(messages):
    if not DATABRICKS_HOST or not DATABRICKS_TOKEN or not DATABRICKS_MODEL_ENDPOINT:
        raise Exception("Databricks AI settings are not configured.")

    url = f"{DATABRICKS_HOST}/serving-endpoints/{DATABRICKS_MODEL_ENDPOINT}/invocations"
    
    system_prompt = """You are a professional SQL Expert. 
Your task is to provide direct, concise SQL queries based on the user's question.
1. ALWAYS wrap SQL code in markdown code blocks (```sql ... ```).
2. ONLY provide the code. DO NOT include explanations, introductions, or conclusions UNLESS the user explicitly asks "Why?" or "Explain".
3. If the question is not about SQL, politely refuse."""

    full_messages = [{"role": "system", "content": system_prompt}] + messages

    payload = {
        "messages": full_messages,
        "temperature": 0.7,
        "max_tokens": 1500
    }

    response = requests.post(url, headers=get_ai_headers(), json=payload)
    if response.status_code != 200:
        raise Exception(f"Databricks API Error ({response.status_code}): {response.text}")

    result = response.json()
    return result['choices'][0]['message']['content']

def generate_sql_challenge(tables_schema, difficulty):
    if not DATABRICKS_HOST or not DATABRICKS_TOKEN or not DATABRICKS_MODEL_ENDPOINT:
        raise Exception("Databricks AI settings are not configured.")

    url = f"{DATABRICKS_HOST}/serving-endpoints/{DATABRICKS_MODEL_ENDPOINT}/invocations"
    
    system_prompt = f"""You are an expert SQL teacher. 
Your task is to generate a {difficulty} level SQL practice problem based on the provided table schemas and sample data.
Ensure the challenge is logically solvable based on the data patterns seen in the sample rows.
Return ONLY a JSON object with the following structure:
{{
  "title": "Short title",
  "description": "Clear problem description",
  "hint": "Subtle hint",
  "solution_sql": "The correct PostgreSQL query to solve it"
}}
DO NOT include any markdown formatting, triple backticks, or extra text. ONLY the raw JSON."""

    payload = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Table Details (Columns & Sample Data):\n{json.dumps(tables_schema, indent=2)}\n\nGenerate a {difficulty} challenge."}
        ],
        "temperature": 0.5,
        "max_tokens": 1000
    }

    response = requests.post(url, headers=get_ai_headers(), json=payload)
    if response.status_code != 200:
        raise Exception(f"Databricks API Error ({response.status_code}): {response.text}")

    result = response.json()
    content = result['choices'][0]['message']['content']
    
    # Try to extract JSON if AI included markdown anyway
    try:
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(0))
        return json.loads(content)
    except:
        # Fallback for very simple cases
        if "{" in content and "}" in content:
            try:
                start = content.find("{")
                end = content.rfind("}") + 1
                return json.loads(content[start:end])
            except: pass
        raise Exception(f"AI failed to generate valid JSON: {content}")
