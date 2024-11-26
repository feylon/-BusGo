import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { useI18n } from 'vue-i18n';
import { apiError } from '@/api/http';

export function useNotify() {
  const toast = useToast();
  const confirm = useConfirm();
  const { t } = useI18n();

  const success = (detail?: string) => toast.add({ severity: 'success', summary: t('common.success'), detail, life: 3000 });
  const error = (err: unknown) => {
    const e = apiError(err);
    const details = Array.isArray(e.details) ? e.details.join(', ') : '';
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: e.code === 'NETWORK' ? t('errors.NETWORK') : `${e.message}${details ? `: ${details}` : ''}`,
      life: 5000,
    });
  };
  const info = (summary: string, detail?: string) => toast.add({ severity: 'info', summary, detail, life: 5000 });

  const ask = (message: string, accept: () => void | Promise<void>, danger = true) =>
    confirm.require({
      header: t('common.confirmTitle'),
      message,
      icon: 'pi pi-exclamation-triangle',
      rejectProps: { label: t('common.no'), severity: 'secondary', outlined: true },
      acceptProps: { label: t('common.yes'), severity: danger ? 'danger' : 'primary' },
      accept,
    });

  return { success, error, info, ask, toast };
}
