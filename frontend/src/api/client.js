import axios from "axios";

const client = axios.create({
  baseURL: "/api",
});

let accessTokenRef = { current: null };
let onAuthFailure = () => {};
let refreshPromise = null;

export function setAccessTokenRef(ref) {
  accessTokenRef = ref;
}

export function setOnAuthFailure(handler) {
  onAuthFailure = handler;
}

client.interceptors.request.use((config) => {
  const token = accessTokenRef.current;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;
    if (!response || response.status !== 401 || config._retried) {
      return Promise.reject(error);
    }
    config._retried = true;

    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      onAuthFailure();
      return Promise.reject(error);
    }

    try {
      if (!refreshPromise) {
        refreshPromise = axios
          .post("/api/auth/refresh", { refresh_token: refreshToken })
          .finally(() => {
            refreshPromise = null;
          });
      }
      const { data } = await refreshPromise;
      accessTokenRef.current = data.access_token;
      localStorage.setItem("refresh_token", data.refresh_token);
      config.headers.Authorization = `Bearer ${data.access_token}`;
      return client(config);
    } catch (refreshError) {
      onAuthFailure();
      return Promise.reject(refreshError);
    }
  }
);

export default client;
