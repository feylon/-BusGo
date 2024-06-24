import { Injectable } from '@nestjs/common';
import { ClientsService } from '../../common/clients.service';

export interface OtpSendResult {
  phone: string;
  expiresIn: number;
  resendIn: number;
  devCode?: string;
}

@Injectable()
export class OtpService {
  constructor(private readonly clients: ClientsService) {}

  send(phone: string, purpose: string, correlationId?: string) {
    return this.clients.sms.post<OtpSendResult>('/otp/send', { phone, purpose }, { correlationId });
  }

  verify(phone: string, code: string, correlationId?: string) {
    return this.clients.sms.post<{ verified: boolean; phone: string }>(
      '/otp/verify',
      { phone, code },
      { correlationId },
    );
  }
}
