import axios from 'axios';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export function getSAToken() {
  return sessionStorage.getItem('sa_token') ?? '';
}

export function saApi() {
  const token = getSAToken();
  return axios.create({
    baseURL: `${API}/api/v1`,
    headers: { Authorization: `Bearer ${token}` },
  });
}
