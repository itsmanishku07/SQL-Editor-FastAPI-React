import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
});

export const getSchemas = async () => {
  const response = await api.get('/schemas');
  return response.data;
};

export const getTables = async (schema = 'public') => {
  const response = await api.get(`/tables?schema=${schema}`);
  return response.data;
};

export const getSchemaDetails = async (schema = 'public') => {
  const response = await api.get(`/schema-details?schema=${schema}`);
  return response.data;
};

export const executeQuery = async (query, schemaName) => {
  const response = await api.post('/execute', { query, schema_name: schemaName });
  return response.data;
};

export const getDbUrl = async () => {
  const response = await api.get('/settings/db-url');
  return response.data;
};

export const updateDbUrl = async (dbUrl) => {
  const response = await api.post('/settings/db-url', { db_url: dbUrl });
  return response.data;
};

// ── Saved Files ──────────────────────────────────────────────────────────────
export const saveFile = async (filename, contentB64) => {
  const response = await api.post('/files/save', { filename, content_b64: contentB64 });
  return response.data;
};

export const listFiles = async () => {
  const response = await api.get('/files');
  return response.data;
};

export const getFile = async (id) => {
  const response = await api.get(`/files/${id}`);
  return response.data;
};

export const deleteFile = async (id) => {
  const response = await api.delete(`/files/${id}`);
  return response.data;
};
