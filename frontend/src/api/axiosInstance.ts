import axios from 'axios'
import { supabase } from '../lib/supabase'

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _retry?: boolean
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
})

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true
      const { data: { session } } = await supabase.auth.refreshSession()
      if (session?.access_token) {
        original.headers.Authorization = `Bearer ${session.access_token}`
        return api.request(original)
      }
      await supabase.auth.signOut()
    }
    return Promise.reject(error)
  }
)

export default api
