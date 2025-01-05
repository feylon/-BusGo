import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { HttpStatus } from '@nestjs/common';
import { AppException } from './nest';
import { CORRELATION_HEADER, INTERNAL_TOKEN_HEADER, sleep } from './utils';

export interface InternalClientOptions {
  baseURL: string;
  token: string;
  timeoutMs?: number;
  retries?: number;
  name: string;
}

export class InternalClient {
  private readonly http: AxiosInstance;

  constructor(private readonly opts: InternalClientOptions) {
    this.http = axios.create({
      baseURL: opts.baseURL,
      timeout: opts.timeoutMs ?? 5000,
      headers: { [INTERNAL_TOKEN_HEADER]: opts.token },
    });
  }

  get<T>(url: string, config: AxiosRequestConfig & { correlationId?: string } = {}) {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  post<T>(url: string, data?: unknown, config: AxiosRequestConfig & { correlationId?: string } = {}) {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  patch<T>(url: string, data?: unknown, config: AxiosRequestConfig & { correlationId?: string } = {}) {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  put<T>(url: string, data?: unknown, config: AxiosRequestConfig & { correlationId?: string } = {}) {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  delete<T>(url: string, config: AxiosRequestConfig & { correlationId?: string } = {}) {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  private async request<T>(config: AxiosRequestConfig & { correlationId?: string }): Promise<T> {
    const { correlationId, ...rest } = config;
    const headers = { ...(rest.headers as Record<string, string>) };
    if (correlationId) headers[CORRELATION_HEADER] = correlationId;
    const safe = rest.method === 'GET';
    const attempts = safe ? (this.opts.retries ?? 2) + 1 : 1;
    let lastErr: AxiosError | undefined;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await this.http.request<T>({ ...rest, headers });
        return res.data;
      } catch (err) {
        const e = err as AxiosError<any>;
        if (e.response && e.response.status < 500) {
          const body = e.response.data ?? {};
          throw new AppException(body.code ?? 'INTERNAL_ERROR', e.response.status, body.details);
        }
        lastErr = e;
        if (i < attempts - 1) await sleep(200 * 2 ** i);
      }
    }
    throw new AppException('SERVICE_UNAVAILABLE', HttpStatus.SERVICE_UNAVAILABLE, {
      service: this.opts.name,
      reason: lastErr?.message,
    });
  }
}
